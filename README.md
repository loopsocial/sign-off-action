# Release Candidate Sign Off Action

Github Action that handles the following:

1. Handles a Release Candidate QA approved sign off
2. Handles a Release Candidate QA rejected sign off

## Inputs

## `github-token`

**Required**
Github token to use to call the Github API.

## `slack-webhook-url`

**Required**
URL of the Slack webhook to send the message to.

## Usage

```yaml
uses: loopsocial/release-candidate-sign-off-action@v1.0.0
with:
  github-token: ${{ secrets.GITHUB_TOKEN }}
  slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
```
