const PRODUCTION_BRANCH = "refactor/prototype-state-root";
const FULL_GIT_SHA = /^[0-9a-f]{40}$/u;

function fail(message) {
  console.error(`Production provenance check failed: ${message}`);
  process.exitCode = 1;
}

if (process.env.VERCEL_ENV === "production") {
  const commitRef = process.env.VERCEL_GIT_COMMIT_REF?.trim();
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();

  if (!commitRef || !commitSha) {
    fail(
      "Git metadata is missing. Direct production builds without Git provenance are forbidden.",
    );
  } else if (commitRef !== PRODUCTION_BRANCH) {
    fail(
      `commit ref ${commitRef} is not the Production branch ${PRODUCTION_BRANCH}.`,
    );
  } else if (!FULL_GIT_SHA.test(commitSha)) {
    fail("VERCEL_GIT_COMMIT_SHA is not a full Git commit SHA.");
  } else {
    console.log(
      `Production provenance verified: ${PRODUCTION_BRANCH}@${commitSha}.`,
    );
  }
}
