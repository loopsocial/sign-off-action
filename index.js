const github = require('@actions/github')
const core = require('@actions/core')

/**
 * Gets the input from the used action.
 * @param {string} key Input key to fetch
 * @returns {string} Returns the value of the input
 */
const getInput = (key) => {
  const input = core.getInput(key)
  if (!input) throw Error(`Input "${key}" was not defined`)
  return input
}

/**
 * Checks if the issue has a label.
 * @param {string} name Name of the label
 * @returns {boolean} True if the label exists
 */
const labelExists = (name) => {
  const { labels } = github.context.issue
  const labelNames = labels.map((label) => label.name)
  return labelNames.includes(name)
}

/**
 * Posts to Slack via webhook.
 * @param {object} body Body to post to Slack
 */
 const postToSlack = async (body) => {
  const { owner, repo } = github.context.repo
  const webhookUrl = await octokit.rest.actions.getRepoSecret({
    owner,
    repo,
    secret_name: 'SLACK_WEBHOOK_URL',
  })

  const request = new Request(webhookUrl, { method: 'POST', body })
  await fetch(request)
}

/**
 * Validates if the issue is a Release Candidate.
 */
const validateReleaseCandidateIssue = () => {
  if (!labelExists('RC')) throw Error('Issue does not have "RC" label')
}

/**
 * Parses the issue body and gets the tag and branch.
 */
const parseIssueBody = () => {
  const { body } = github.context.issue
  
  // Extract release tag with regex
  const tagRegex = new RegExp(/^-\sRelease\stag:\s(v[0-9]{8}.[0-9])$/m)
  const tagMatch = body.match(tagRegex)
  if (!tagMatch) throw Error('No "Release Tag" found in issue body')
  const tag = tagMatch[1]

  // Extract branch with regex
  const branchRegex = new RegExp(/^-\sBranch:\s(release\/v[0-9]{8}.[0-9]+)$/m)
  const branchMatch = body.match(branchRegex)
  if (!branchMatch) throw Error('No "Branch" found in issue body')
  const branch = branchMatch[1]

  return { tag, branch } 
}

/**
 * Handles release signed off.
 * @param {object} octokit Octokit
 * @param {string} tag Tag that will be used for the release
 * @param {string} branch Branch that will be used for the release
 * @returns {string} Release URL on Github
 */
const handleReleaseSignedOff = async (octokit, tag, branch) => {
  if (labelExists('QA Approved')) {
    const { owner, repo } = github.context.repo
    
    // Create the release
    const { data: { html_url: releaseUrl } } = await octokit.rest.repos.createRelease({
      owner,
      repo,
      name: tag,
      tag_name: tag,
      draft: true,
      target_commitish: branch
    })

    // Post success message
    await postToSlack({
      "blocks": [
        {
          "type": "header",
          "text": {
            "type": "plain_text",
            "text": `[${tag}] Release approved ✅`
          }
        },
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "The Release Candidate is approved for publishing."
          },
          "accessory": {
            "type": "button",
            "text": {
              "type": "plain_text",
              "text": "Go"
            },
            "url": `${releaseUrl}`,
            "action_id": "button-action"
          }
        }
      ]
    })
  }
}

/**
 * Handles cancelling the release.
 * @param {object} octokit Octokit
 * @param {string} tag Tag that was meant to be released
 * @param {string} branch Release branch that will be deleted
 */
const handleReleaseCancelled = async (octokit, tag, branch) => {
  if (!labelExists('QA Approved')) {
    const { owner, repo } = github.context.repo

    // Delete Release Candidate branch
    await octokit.rest.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branch}`
    })

    // Post cancelled message
    await postToSlack({
      "blocks": [
        {
          "type": "header",
          "text": {
            "type": "plain_text",
            "text": `[${tag}] Release cancelled ❌`
          }
        },
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "The Release Candidate was cancelled."
          }
        }
      ]
    })
  }
}

const run = async () => {
  try {
    // Get token and init
    const token = getInput('github-token')
    const octokit = github.getOctokit(token)

    // Validates if the issue is a Release Candidate
    validateReleaseCandidateIssue()
    const { tag, branch } = parseIssueBody()

    // Handle release signed off
    await handleReleaseSignedOff(octokit, tag, branch)

    // Handle release cancelled
    await handleReleaseCancelled(octokit, tag, branch)
  } catch (error) {
    core.setFailed(error.message)
  }
}
run()
