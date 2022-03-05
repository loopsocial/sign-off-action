# Sign Off Action

Github Action that handles the following:

1. Handles a Release Candidate or Hotfix QA approved sign off
2. Handles a Release Candidate or Hotfix QA rejected sign off

## Inputs

### `github-token`

**Required**
Github token to use to call the Github API. This can be the default `GITHUB_TOKEN`.

### `slack-webhook-url`

**Required**
URL of the Slack webhook to send the message to.

## Example Usage

```yaml
name: Sign Off

on:
  issues:
    types: [closed]

jobs:
  sign_off:
    runs-on: ubuntu-latest
    name: Sign Off Release/Hotfix
    steps:
      - name: Sign Off Release/Hotfix
        id: sign_off
        uses: loopsocial/sign-off-action@v1.0.4
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
```
