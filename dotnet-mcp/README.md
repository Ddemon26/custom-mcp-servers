# dotnet-mcp

A Model Context Protocol server that exposes common [.NET CLI](https://learn.microsoft.com/dotnet/core/tools/) commands as tools. The server lets MCP-compatible clients manage projects, restore dependencies, build, test, and publish applications without leaving the conversational interface.

## Available tools

- `dotnet_restore` – run `dotnet restore` with support for runtime, verbosity, and cache flags.
- `dotnet_build` – compile a project or solution with configuration, framework, RID, and output options.
- `dotnet_test` – execute test suites with optional filters, logger selection, and diagnostics collection.
- `dotnet_run` – start an application, optionally specifying configuration, framework, RID, launch profile, and extra arguments.
- `dotnet_new` – scaffold new projects, solutions, or files from templates with language/framework control.
- `dotnet_add_package` – add NuGet package references to a project with version, prerelease, and source controls.
- `dotnet_clean` – remove build outputs for a specific target.
- `dotnet_publish` – build and publish deployable artifacts, including self-contained deployments.

All tools allow specifying a `working_directory` so commands can be executed inside any project folder.

## Development

```bash
npm install
npm run build
npm start    # launches the compiled server on stdio
```

For iterative work you can use `npm run dev` (requires `ts-node`).
