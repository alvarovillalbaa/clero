# Publish the files you own

A build creates a static directory with the reader, your project bundle,
original Markdown and an output manifest. No server account, model provider,
database or runtime package installation is required to read the published site.

## Build before sharing

```sh
node bin/clero.mjs check ./my-docs
node bin/clero.mjs build ./my-docs --out ./release-1
```

Use a new output directory. The tool validates the project and its internal
links before creating output. It refuses existing destinations instead of
guessing which files it can replace.

## Choose your host

Upload the entire output directory to a static host. Keep its folders and
relative assets together. The host must serve JavaScript modules with an
appropriate content type. Page selection uses a query parameter, so direct
page URLs work without a custom route rewrite.

The Clero repository builds its own documentation through Vercel. Other
projects can use the same CLI command in their own deployment process.
The workspace does not create hosting projects or submit deployments for you.

## Review what becomes public

Every configured page enters the public project bundle and the source folder.
Only include documentation you intend to publish. Browser-local drafts remain
on this device until you explicitly export and publish their content.

The output manifest records generated file hashes. It describes build content;
it is not a signed security attestation or proof of browser acceptance.

Read the [current scope](limits.md).
