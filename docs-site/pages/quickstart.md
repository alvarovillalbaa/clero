# Your first documentation site

Use Node.js 24.21 or newer. Clero has no runtime dependency to install.

## Get the source

```sh
git clone https://github.com/alvarovillalbaa/clero.git
cd clero
```

## Create a project

Choose a directory that does not already exist:

```sh
node bin/clero.mjs init ./my-docs
```

Open the new Markdown files in your editor. Change the project name and page
order in **clero.json**. All page files are explicitly listed there.

## Check and build

```sh
node bin/clero.mjs check ./my-docs
node bin/clero.mjs build ./my-docs --out ./my-docs-site
```

The output directory must be new. Clero refuses to overwrite an existing
directory. For another local build, choose a fresh output path. Every configured
page has actual HTML at its directory URL; basic reading needs no JavaScript.

Serve that directory with your usual static web server or upload it to your
static host. Open the site over HTTP; browser modules are not designed for a
file-URL preview.

## Bring a browser workspace

Choose **Workspace**, make your changes and export the project JSON. The same
CLI can check and build that actual export:

```sh
node bin/clero.mjs check ./workspace.json
node bin/clero.mjs build ./workspace.json --out ./workspace-site
```

Continue with [writing pages](writing.md) or [publishing](publishing.md).
