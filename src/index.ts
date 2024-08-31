// This app is a GitHub bot that checks if a pull request has all the required actions in the workflows that are triggered by the PR.
// The bot will check the workflows and any reusable workflows that are used in the workflows to see if the required actions are present.
// The required actions are defined in the config.yml file.
// The is also a break ceiling feature that allows the bot to skip the workflow checks if the PR has a specific label or title.
// Description: This is the main file where the Probot app is initialized and the event listeners are defined.

import { Probot } from "probot";
import { handlePullRequest } from "./handlePullRequest.js";

export default (app: Probot) => {
  app.on(['pull_request.opened', 'pull_request.synchronize',
          'pull_request.labeled', 'pull_request.unlabeled',
          'pull_request.edited', 'pull_request.reopened'
    ], async (context) => {

    // Suppress the default logging displaying the webhook payload id
    const logger = context.log.child({});

    logger.info("Processing pull request: %s", context.payload.pull_request.html_url);
    
    await handlePullRequest(context, logger);
    
  });
};
