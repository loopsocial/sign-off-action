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

// const createRelease = async (octokit, latestTag) => {
//   const { owner, repo } = github.context.repo()
//   const { status, commits } = await octokit.rest.repos.compareCommitsWithBasehead({
//     owner,
//     repo,
//     basehead: `${latestTag}...${github.context.sha}`,
//     per_page: 100
//   })

//   if (status !== 'ahead') throw Error('Head branch is not ahead of base branch')
  
//   return commits.reduce((prev, curr) => prev + `${curr.commit.message}\n`, "")
// }

const postToSlack = async (nextTag, issueUrl) => {
  const body = {
    "blocks": [
      {
        "type": "header",
        "text": {
          "type": "plain_text",
          "text": `[${nextTag}] Release Candidate created 🧪`
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "The Release Candidate is ready for testing."
        },
        "accessory": {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Go"
          },
          "url": issueUrl,
          "action_id": "button-action"
        }
      }
    ]
  }

  const { owner, repo } = github.context.repo()
  const webhookUrl = await octokit.rest.actions.getRepoSecret({
    owner,
    repo,
    secret_name: 'SLACK_WEBHOOK_URL',
  })

  const request = new Request(webhookUrl, { method: 'POST', body })
  await fetch(request)
}

const run = async () => {
  try {
    // Get token and init
    const token = getInput('github-token')
    const octokit = github.getOctokit(token)

    // Validate issue
    validateIssueLabels()
    
    // Parse tag and branch to create the release
    const { tag, branch } = parseIssueBody()

    // Send webhook to Slack
    // await postToSlack(nextTag, issueUrl)
  } catch (error) {
    core.setFailed(error.message)
  }
}
run()
