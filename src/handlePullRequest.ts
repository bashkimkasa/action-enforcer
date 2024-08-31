import yaml from "js-yaml";
import fs from "fs";
import path from "path";
import { Context } from "probot";

const __dirname = path.resolve();

interface RequiredAction {
  name: string;
}

interface BreakCeiling {
  label?: string;
  title?: string;
}

interface Directives {
  checkReusableWorkflows: boolean;
}

interface Config {
  requiredActions: RequiredAction[];
  breakCeiling: BreakCeiling;
  directives: Directives;
}

interface Workflow {
  jobs: Record<string, any>;
}

const loadConfig = (): Config => {
  const filePath = path.join(__dirname, "config.yml");
  const fileContents = fs.readFileSync(filePath, "utf8");
  const data = yaml.load(fileContents) as Config;
  return data;
};

export const checkWorkflow = async (
  workflow: Workflow,
  requiredActions: RequiredAction[],
  configDirectives: Directives,
  context: any,
  logger: any,
  owner: string,
  repo: string,
  ref: string,
  foundActionsSoFar?: Set<string>
): Promise<boolean> => {
  const jobs = workflow.jobs;
  const foundActions = foundActionsSoFar || new Set<string>();

  //First check if the required actions are used in the workflow (no need to check reusable workflows yet)
  for (const jobName in jobs) {
    const steps = jobs[jobName].steps;
    if (!steps) {
      continue;
    }

    // Check if any of the required actions are used in the steps
    // Use includes() to check for substring matches in case the version is not specified in the config file
    for (const step of steps) {
      for (const requiredAction of requiredActions) {
        if (step.uses && step.uses.includes(requiredAction.name)) {
          foundActions.add(requiredAction.name);
        }
      }
    }
  }

  // Check if all required actions are found in the workflow
  let allActionsFound = requiredActions.every(action => foundActions.has(action.name));
  if (allActionsFound) {
    return true;
  }

  // Now check if any reusable workflows are used in the workflow and check those as well
  if (configDirectives.checkReusableWorkflows) {
    for (const jobName in jobs) {  
      if (jobs[jobName].uses) {
        let repoOwner, repoName, workflowPath, workflowRef;
        // If resuable workflow is local to the repo, the uses property will be in the format "./.github/workflows/{filename}"
        // If reusable workflow is from another repo, the uses property will be in the format "{owner}/{repo}/.github/workflows/{filename}@{ref}"
        if (jobs[jobName].uses.startsWith("./")) {
          repoOwner = owner;
          repoName = repo;
          workflowPath = jobs[jobName].uses.slice(2);
          workflowRef = ref;
        } else {
          // External reusable workflow
          const [fullRepo, filePathWithRef] = jobs[jobName].uses.split('/.github/workflows/');
          [repoOwner, repoName] = fullRepo.split('/');
          const [filePath, foundRef] = filePathWithRef.split('@');
          workflowPath = `.github/workflows/${filePath}`
          workflowRef = foundRef || "main";
        }

        //Check if permissions allow for fetching the reusable workflow
        try {
          const reusableWorkflowResponse = await context.octokit.repos.getContent({
            owner: repoOwner,
            repo: repoName,
            path: workflowPath,
            ref: workflowRef
          });
          const reusableWorkflowContent = Buffer.from(reusableWorkflowResponse.data.content, 'base64').toString();
          const reusableWorkflowYaml = yaml.load(reusableWorkflowContent) as Workflow;
  
          // Recursively check the reusable workflow
          const reusableWorkflowValid = await checkWorkflow(reusableWorkflowYaml, requiredActions, configDirectives, context, logger, owner, repo, ref, foundActions);
          if (reusableWorkflowValid) {
            return true; // If the reusable workflow is valid, return true
          }
        } catch (error: any) {
          if (error.status === 404) {
            logger.error(`Workflow not found: Unable to access ${repoOwner}/${repoName}/${workflowPath}@${workflowRef}`);
          } else if (error.status === 403) {
            logger.error(`Permission denied: Unable to access ${repoOwner}/${repoName}/${workflowPath}@${workflowRef}`);
          } else {
            logger.error(`Error fetching workflow: ${repoOwner}/${repoName}/${workflowPath}@${workflowRef}, Message Details: ${error.message}`);
          }
          continue;
        }
      }
    }
  }

  // If all required actions are found, return true
  return requiredActions.every(action => foundActions.has(action.name));
}

export async function handlePullRequest(context: Context<any>, logger: any) {
  const pullRequest = context.payload.pull_request;
  const owner = pullRequest.base.repo.owner.login;
  const repo = pullRequest.base.repo.name;
  const ref = pullRequest.head.ref;

  // Load the configuration
  const config = loadConfig();
  const requiredActions = config.requiredActions;
  const breakCeiling = config.breakCeiling;
  const configDirectives = config.directives;

  let skipCheck = false;

  // Check for break ceiling conditions
  if (breakCeiling.label && pullRequest.labels.some((label: any) => label.name === breakCeiling.label)) {
    logger.info("Break ceiling label found, skipping workflow checks.");
    skipCheck = true;
  }

  if (breakCeiling.title && pullRequest.title.includes(breakCeiling.title)) {
    logger.info("Break ceiling title found, skipping workflow checks.");
    skipCheck = true;
  }

  if (skipCheck) {
    // Set the status check to "success"
    await context.octokit.repos.createCommitStatus({
      owner,
      repo,
      sha: pullRequest.head.sha,
      state: 'success',
      context: 'required-actions-check',
      description: "Break ceiling condition met, skipping workflow checks.",
      target_url: "https://api.github.com",
    });
    return;
  }

  logger.info("Checking workflows for PR: %s", pullRequest.html_url);
  
  // Get workflows triggered by the PR
  const workflowsResponse = await context.octokit.actions.listRepoWorkflows({
    owner,
    repo
  });

  let allWorkflowsValid = false;

  for (const workflow of workflowsResponse.data.workflows) {
    // Get the workflow YAML file content
    const workflowResponse = await context.octokit.repos.getContent({
      owner,
      repo,
      path: workflow.path,
      ref
    });

    // Get workflow content
    const workflowContent = Buffer.from((workflowResponse.data as any).content, 'base64').toString('utf-8');
    const workflowYaml = yaml.load(workflowContent) as Workflow;

    // Check the workflow and any reusable workflows
    if (await checkWorkflow(workflowYaml, requiredActions, configDirectives, context, logger, owner, repo, ref)) {
      allWorkflowsValid = true;
      break; // If one workflow is valid, no need to check others
    }
  }

  logger.info("All workflows valid: %s (PR: %s)", allWorkflowsValid, pullRequest.html_url);
  logger.info("Setting status check for PR: %s", pullRequest.html_url);

  if (!allWorkflowsValid) {
    // Block the PR by setting a status check to "failure"
    await context.octokit.repos.createCommitStatus({
      owner,
      repo,
      sha: pullRequest.head.sha,
      state: 'failure',
      context: 'required-actions-check',
      description: "One or more workflows are missing required actions.",
      target_url: "https://api.github.com",
    }); 
  } else {
    // Set the status check to "success"
    await context.octokit.repos.createCommitStatus({
      owner,
      repo,
      sha: pullRequest.head.sha,
      state: 'success',
      context: 'required-actions-check',
      description: "All workflows have the required actions.",
      target_url: "https://api.github.com",
    });
  }

  logger.info("Status check set for PR: %s", pullRequest.html_url);
}