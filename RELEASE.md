# Release procedure

Releases use signed Git tags and npm staged publishing. The workflow stages an
exact package, but a maintainer must approve that package with two-factor
authentication (2FA) before npm makes it public.

Do not create or move a release tag manually. Do not run `npm publish` from a
workstation.

## One-time npm prerequisite

Before the first release with this workflow, open the npm package access
settings for `@photostructure/windows-registry` and verify the Trusted Publisher
has these exact values:

- Publisher: GitHub Actions
- Organization or user: `photostructure`
- Repository: `vscode-windows-registry`
- Workflow filename: `publish.yaml`
- Environment: empty
- Allowed action: only **Allow npm stage publish**
- Direct publishing: **Allow npm publish** disabled

Set Publishing access to **Require two-factor authentication and disallow
tokens**. Recheck the Trusted Publisher whenever `publish.yaml` is renamed; npm
matches the case-sensitive workflow filename exactly.

## Prepare the release

1. Add the release notes to `CHANGELOG.md` on `main`.
2. Run `npm run preflight` and review the dependency updates.
3. Push the completed changes and wait for the ordinary `main` build to pass.
4. Confirm that `main` has not moved to a different commit.

## Stage the package

1. Open **Build & Prepare Release** in GitHub Actions.
2. Select **Run workflow** on `main`.
3. Choose `patch`, `minor`, or `major` from the consumer-visible change.
4. Wait for **Build & Prepare Release** to finish.
5. Wait for the tag-bound **Stage npm Release** workflow to finish.

The first workflow runs the full test matrix, creates a signed release commit
and annotated tag, and starts the second workflow at that tag. The second
workflow validates the tag, builds and verifies both Windows prebuilds, tests
installation from the exact tarball, stages it on npm, and creates the GitHub
release.

## Security design notes

- The release job deliberately persists the checkout credential so it can make
  one atomic push. It installs no project dependencies, has no npm authority,
  accepts only a validated version choice, and rechecks the remote `main` SHA.
  This is the expected `zizmor` auditor exception for `artipacked`.
- The combined build and manual-release workflow intentionally has no
  workflow-level concurrency group: ordinary pushes and pull requests must not
  gate a manual release. The release job and complete publishing workflow have
  their own non-canceling concurrency groups.
- Organization-scoped SSH signing inputs are exposed only to the isolated
  release job. That job executes no project dependency or build output.
- Build and test dependencies run only in jobs with no secrets or OIDC
  authority. The production dependency audit must remain clean; development
  audit findings must be reviewed before each release.

## Approve the npm stage

1. Open **Staged Packages** from the npm user menu.
2. Confirm the package name, version, file list, metadata, and provenance.
3. Confirm that the provenance identifies this repository, `publish.yaml`, the
   release tag, and the signed tag commit.
4. Approve the staged package with 2FA.
5. Confirm that npm lists the version publicly.
6. Confirm that the GitHub release exists and is immutable.

## Recover from a failed release

- If the pre-tag test fails, fix `main` and start a new release run.
- If the tag push succeeds but publisher dispatch fails, rerun only the
  dispatch job or start `publish.yaml` manually at the existing signed tag.
- If the tagged workflow is defective, fix `main` and release a new version.
  Never move the existing tag.
- If the staged contents are wrong, reject the stage and release a new version.
- If npm publishes a bad release, deprecate it or publish a corrected version.
  Never overwrite a published version.
