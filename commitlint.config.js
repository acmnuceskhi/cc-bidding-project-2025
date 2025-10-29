module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Lenient: Use warnings (1) instead of errors (2)
    "type-enum": [
      1, // Warning only
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "test",
        "chore",
        "perf",
        "build",
        "ci",
        "revert",
      ],
    ],
    "type-empty": [1, "never"], // Warning
    "subject-empty": [1, "never"], // Warning

    // Disable strict formatting checks
    "type-case": [0], // Allow any case
    "subject-case": [0], // Allow any case
    "subject-full-stop": [0], // Allow periods
    "header-max-length": [0], // No length limit
    "body-leading-blank": [0],
    "body-max-line-length": [0],
    "footer-leading-blank": [0],
    "footer-max-line-length": [0],
  },
};
