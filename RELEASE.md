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

1. Add the release notes to `CHANGELOG.md` on `main`, under a heading that
   names the version bump: `## [Unreleased (patch)]`, `## [Unreleased (minor)]`,
   or `## [Unreleased (major)]`. The release workflow renames it to
   `## [X.Y.Z] - YYYY-MM-DD`, and those notes become the GitHub release notes.
2. Run `npm run preflight` and review the dependency updates.
3. Push the completed changes and wait for the ordinary `main` build to pass.
4. Confirm that `main` has not moved to a different commit.

## Stage the package

1. Open **Build & Prepare Release** in GitHub Actions.
2. Select **Run workflow** on `main`.
3. Wait for **Build & Prepare Release** to finish.
4. In the tag-bound **Stage npm Release** workflow, wait for the **Stage
   package on npm** job to finish. Leave the workflow running: its **Create
   immutable GitHub release** job waits for your npm approval.

## How the release works

- `build.yml` (**Build & Prepare Release**) reads the version bump from the
  `## [Unreleased (patch|minor|major)]` heading in `CHANGELOG.md` while the
  test matrix runs, and fails with instructions if that heading is missing,
  names no bump, or has no notes under it. Once both pass, it bumps the
  version, renames the heading to `## [X.Y.Z] - YYYY-MM-DD` with a new empty
  `## [Unreleased]` above it, adds the version's `[X.Y.Z]: <url>` link
  definition, pushes a signed release commit and annotated tag, and starts
  `publish.yaml` at that tag.
  [`photostructure/changelog-release-action`](https://github.com/photostructure/changelog-release-action)
  does the `CHANGELOG.md` work and the npm wait below.
- `publish.yaml` (**Stage npm Release**) validates the tag, builds and verifies
  both Windows prebuilds, tests installation from the exact tarball, and stages
  it with `npm stage publish`. npm trusts only this workflow file, by name, to
  stage the package, so renaming it means changing the package's
  trusted-publisher settings on npmjs.com.
- npm validates a staged package, which can take 10 to 30 minutes, then holds it
  until a maintainer approves it with 2FA.
- The **Create immutable GitHub release** job checks npm every 5 minutes, for up
  to 5 hours 45 minutes. Any npm error other than "not found" (E404) ends the
  job early. Once npm serves the version, it re-verifies the signed tag and
  creates the immutable GitHub release. Its notes are the version's
  `CHANGELOG.md` section, followed by GitHub's generated notes. GitHub emails
  the release to the repository's watchers at that moment, so the email always
  announces a version they can install.

## Security design notes

- The release job deliberately persists the checkout credential so it can make
  one atomic push. It installs no project dependencies, has no npm authority,
  accepts only a validated version bump, and rechecks the remote `main` SHA.
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
6. Wait for the **Create immutable GitHub release** job to finish, then confirm
   that the GitHub release exists, is immutable, and has the version's
   `CHANGELOG.md` section at the top of its notes.

## Recover from a failed release

- If the pre-tag test fails, fix `main` and start a new release run.
- If the tag push succeeds but publisher dispatch fails, rerun only the
  dispatch job or start `publish.yaml` manually at the existing signed tag.
- If the tagged workflow is defective, fix `main` and release a new version.
  Never move the existing tag.
- If the staged contents are wrong, reject the stage and release a new version.
  The rejected run's **Create immutable GitHub release** job then runs out of
  checks and fails without creating a release. Cancel that run, or ignore its
  failure, and do not re-run it.
- In the two cases above, the release commit has already moved the notes under
  `## [X.Y.Z] - YYYY-MM-DD` in `CHANGELOG.md`, and the next release run fails
  until `## [Unreleased]` names a bump and has notes. Rename that empty heading
  to `## [Unreleased (patch|minor|major)]`, move the unpublished version's notes
  under it, leave a line under `## [X.Y.Z]` saying that version was never
  published, and then start the new release.
- If the **Create immutable GitHub release** job fails before it creates the
  release (its checks ran out before you approved the stage, or `npm view`
  failed with an error other than E404), approve the stage if you have not,
  then use **Re-run failed jobs** on that **Stage npm Release** run. GitHub
  allows re-runs for 30 days. Do not start a new release.
- If npm publishes a bad release, deprecate it or publish a corrected version.
  Never overwrite a published version.
