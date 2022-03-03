const github = require('@actions/github')
const core = require('@actions/core')

const getInput = (key) => {
  const input = core.getInput(key)
  if (!input) throw Error(`Input "${key}" was not defined`)
  return input
}

// Checks if the issue has the expected `RC` and `QA Approved` labels
const validateIssueLabels = () => {
  const { labels } = github.context.issue()
  const labelNames = labels.map((label) => label.name)
  if (!labelNames.includes('RC')) throw Error('Issue does not have "RC" label')
  if (!labelNames.includes('QA Approved')) throw Error('Issue does not have "QA Approved" label')
}

// Parses the issue body and gets the tag and branch 
const parseIssueBody = () => {
  const { body } = github.context.issue()
  
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

// Creates the release tag
const createRelease = async (octokit, tag, branch) => {
  const { owner, repo } = github.context.repo()
  const { data: { html_url } } = await octokit.rest.repos.createRelease({
    owner,
    repo,
    name: tag,
    tag_name: tag,
    draft: true,
    target_commitish: branch
  })

  return html_url
}

const postReleaseApproved = async (tag, releaseUrl) => {
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

// Posts to Slack via webhook
const postToSlack = async (body) => {
  const { owner, repo } = github.context.repo()
  const webhookUrl = await octokit.rest.actions.getRepoSecret({
    owner,
    repo,
    secret_name: 'SLACK_WEBHOOK_URL',
  })

  const request = new Request(webhookUrl, { method: 'POST', body })
  await fetch(request)
}

const deleteReleaseBranch = async (octokit, tag, branch) => {
  const { labels } = github.context.issue()
  const labelNames = labels.map((label) => label.name)
  if (labelNames.includes('RC') && !labelNames.includes('QA Approved')) {
    const { owner, repo } = github.context.repo()

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

    // Handle release signed off
    validateIssueLabels()
    const { tag, branch } = parseIssueBody()
    const releaseUrl = await createRelease(octokit, tag, branch)
    await postReleaseApproved(tag, releaseUrl)

    // Handle release cancelled
    await deleteReleaseBranch(octokit, tag, branch)
  } catch (error) {
    core.setFailed(error.message)
  }
}
run()
