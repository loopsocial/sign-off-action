const github = require('@actions/github')
const core = require('@actions/core')

const getInput = (key) => {
  const input = core.getInput(key)
  if (!input) throw Error(`Input "${key}" was not defined`)
  return input
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

// Tags are formatted as: YYYYMMDD.N
// N is the current deployment of the day, starting with 1.
// If multiple deployments happen on the same date, N increments.
// const getTags = async (octokit) => {
//   const { owner, repo } = github.context.repo()
//   const tags = await octokit.rest.repos.listTags({ owner, repo })
  
//   // Loop through tags and see if there is another tag from today.
//   const today = getTodaysDate()
//   const latestTag = tags.find((tag) => tag.name.startsWith('v'))
//   const existing = tags.find((tag) => tag.name.startsWith(`v${today}`))
//   let nextTag
//   if (existing) {
//     // Found existing tag, increment the N by 1.
//     const [, n] = existing.split('.')
//     nextTag = `v${today}.${Number.parseInt(n) + 1}`
//   } else {
//     // No existing tag found, start N at 1.
//     nextTag = `v${today}.1`
//   }
//   return { latestTag, nextTag }
// }

// const getCommitDiff = async (octokit, latestTag) => {
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

// const createReleaseBranch = async (octokit, nextTag) => {
//   const { owner, repo } = github.context.repo()
//   await octokit.rest.git.createRef({
//     owner,
//     repo,
//     ref: `refs/heads/release/${nextTag}`,
//     sha: github.context.sha
//   })
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
    
    // Get next tag and commit history 
    const { tag, branch } = parseIssueBody()

    // Send webhook to Slack
    // await postToSlack(nextTag, issueUrl)
  } catch (error) {
    core.setFailed(error.message)
  }
}
run()
