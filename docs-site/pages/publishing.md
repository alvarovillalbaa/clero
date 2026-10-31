# Publish the files you own

A build creates a static directory with the reader, your project bundle,
original Markdown and an output manifest. No server account, model provider,
database or runtime package installation is required to read the published site.

## Build before sharing

```sh
node bin/clero.mjs check ./my-docs
node bin/clero.mjs build ./my-docs --out ./release-1 --site-url https://docs.example.com/
```

Use a new output directory. The tool validates the project and its internal
links before creating output. It refuses existing destinations instead of
guessing which files it can replace.

## Choose your host

Upload the entire output directory to a static host. Keep its folders and
relative assets together. The host must serve JavaScript modules with an
appropriate content type. Each page has its own directory and complete HTML,
so page content, navigation and contents are available before JavaScript loads.
Search, theme controls and the local workspace use JavaScript. Older query-page
links are still understood by the interactive reader.

The optional **--site-url** is your actual HTTPS publishing root. It enables
canonical page metadata, **sitemap.xml** and **robots.txt**. Include a base path
if the site lives beneath one. Recovery from an unknown page uses that configured
mount path; without the option, 404 recovery assumes the host root. These files
describe your intended public URLs; they do not verify ownership or indexing.

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
