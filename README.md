# action-enforcer

> A GitHub App built with [Probot](https://github.com/probot/probot) for scanning pull request workflows for a list of required actions.

## Overview
This app listens for Pull Requests and scans the executed workflows from the PR for certain actions to make sure that are used. The configuration of the required actions is stored in the `config.yaml` along with break ceiling functionality and optional directives. If all the required actions are used, set successful commit status, otherwise set a failure.

If a workflow calls a reusable workflow drill down recursively and do the same checks.


## Configuration
1. If running locally copy the provided `.env.example` into a `.env` file and fill in all the required variables or set them as environment variables accordingly.
2. For non-local runs, setup the environment variables (list provided in `.env.example` file)
3. When registering this github app, all the permissions you need to set are documented in the provided `app.yml` file.
4. If you do not want or cannot (due to permission issues) access the content of the reusable workflows simply turn off the option in the `config.yaml` file.


## Setup

```sh
# Install dependencies
npm install

# Test
npm run test

# Build
npm run build

# Run the bot
npm start
```

## Docker

```sh
# 1. Build container
docker build -t action-enforcer .

# 2. Start container (add in all required environment variables)
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> -e ALL_OTHER_ENV=<value> action-enforcer
```

## Notes
Currently there is only a single sample test. A complete set of tests has yet to be implemented.


## Contributing

If you have suggestions for how action-enforcer could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2024 bashkimkasa
