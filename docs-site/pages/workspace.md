# Make a workspace your own

Open **Workspace** from the reader to edit an actual project. You can change
page content and metadata, add pages, remove pages, and preview the result.

## Import and preview

Import a Clero project JSON file to continue work from another device. A valid
file uses **clero.project.v1** and includes the original Markdown for each page.
The workspace checks its shape, identities and size before replacing a project.

Apply your edits to preview them. Invalid input stays available to fix. A
preview changes your workspace; it does not publish a new version of this site.

## Keep a local draft

Use the explicit save control to keep a draft in this browser. The interface
acknowledges a successful save and shows storage failures. Browser storage can
be unavailable, full, cleared or tied to one browser profile. Export a file
when you need a portable copy.

The on-device draft can be cleared explicitly. That removes Clero's draft key
only; it does not delete your downloaded files or change the published site.

## Export and publish

Export downloads a real JSON bundle containing your project and Markdown.
There is no automatic upload, account sync or hosted team workspace. To publish
the export, run the CLI build command described in the [quickstart](quickstart.md).

Page links in a local-only workspace are useful on this device. Export and
publish the project before sharing those pages with other readers.
