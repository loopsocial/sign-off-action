const github = require('@actions/github')
const core = require('@actions/core')
const axios = require('axios')

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
 * Gets the issue.
 * @param {object} octokit Octokit
 * @returns {object} Issue
 */
const getIssue = async (octokit) => {
  const { owner, repo } = github.context.repo
  const { number: issueNumber } = github.context.issue
  const { data: issue } = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber
  })
  return issue
}

/**
 * Gets the labels for a given issue.
 * @param {array} labels Issue labels
 * @returns {array} List of label names
 */
 const getLabels = (labels) => {
  return labels.map((label) => label.name)
}

/**
 * Posts to Slack via webhook.
 * @param {object} body Body to post to Slack
 */
 const postToSlack = async (body) => {
  const webhookUrl = getInput('slack-webhook-url')
  await axios.post(webhookUrl, body)
}

/**
 * Validates if the issue is a Release Candidate.
 * @param {array} labels List of label names for the issue
 */
const validateReleaseCandidateIssue = (labels) => {
  if (!labels.includes('RC')) throw Error('Issue does not have "RC" label')
}

/**
 * Parses the issue body and gets the tag and branch.
 * @param {object} body Issue body
 * @returns {object} Tag and branch
 */
const parseIssueBody = (body) => {
  // Extract release tag with regex
  const tagRegex = new RegExp(/-\sRelease\stag:\s(.+)\r\n/m)
  const tagMatch = body.match(tagRegex)
  if (!tagMatch) throw Error(`No "Release tag" found in issue body:\n${body}`)
  const tag = tagMatch[1]

  // Extract branch with regex
  const branchRegex = new RegExp(/-\sBranch:\s(.+)\r\n/m)
  const branchMatch = body.match(branchRegex)
  if (!branchMatch) throw Error(`No "Branch" found in issue body:\n${body}`)
  const branch = branchMatch[1]

  return { tag, branch } 
}

/**
 * Handles release signed off.
 * @param {array} labels List of labels
 * @param {object} octokit Octokit
 * @param {string} tag Tag that will be used for the release
 * @param {string} branch Branch that will be used for the release
 * @returns {string} Release URL on Github
 */
const handleReleaseSignedOff = async (labels, octokit, tag, branch) => {
  if (labels.includes('QA Approved')) {
    const { owner, repo } = github.context.repo
    
    // Create the release
    const { data: { html_url: releaseUrl } } = await octokit.rest.repos.createRelease({
      owner,
      repo,
      name: tag,
      tag_name: tag,
      draft: false,
      target_commitish: branch
    })

    // Post success message
    await postToSlack({
      "blocks": [
        {
          "type": "header",
          "text": {
            "type": "plain_text",
            "text": `[${tag}] Release/Hotfix approved ✅`
          }
        },
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `\`${branch}\` is approved for publishing.`
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
 * @param {array} labels List of labels
 * @param {object} octokit Octokit
 * @param {string} tag Tag that was meant to be released
 * @param {string} branch Release branch that will be deleted
 */
const handleReleaseCancelled = async (labels, octokit, tag, branch) => {
  if (!labels.includes('QA Approved')) {
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
            "text": `[${tag}] Release/Hotfix cancelled ❌`
          }
        },
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `\`${branch}\` was cancelled.`
          }
        }
      ]
    })
  }
}

const run = async () => {
  try {
    // Get token and init
    const token = getInput('workflow-token')
    const octokit = github.getOctokit(token)
    const issue = await getIssue(octokit)
    const labels = getLabels(issue.labels)

    // Validates if the issue is a Release Candidate
    validateReleaseCandidateIssue(labels)
    const { tag, branch } = parseIssueBody(issue.body)

    // Handle release signed off
    await handleReleaseSignedOff(labels, octokit, tag, branch)

    // Handle release cancelled
    await handleReleaseCancelled(labels, octokit, tag, branch)
  } catch (error) {
    core.setFailed(error.message)
  }
}
run()
