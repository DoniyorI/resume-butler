import assert from "node:assert/strict";
import { test } from "node:test";
import { SKILL_ALIASES, skillLabel } from "@/server/ats/skills";

const plain = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

test("irregular names are spelled the way people write them", () => {
  const expected = {
    postgresql: "PostgreSQL",
    mysql: "MySQL",
    sql: "SQL",
    nosql: "NoSQL",
    javascript: "JavaScript",
    typescript: "TypeScript",
    "node.js": "Node.js",
    "next.js": "Next.js",
    ".net": ".NET",
    "asp.net": "ASP.NET",
    ios: "iOS",
    aws: "AWS",
    "ci/cd": "CI/CD",
    graphql: "GraphQL",
    grpc: "gRPC",
    "rest api": "REST API",
    "c++": "C++",
    "c#": "C#",
    jquery: "jQuery",
    pytorch: "PyTorch",
    "scikit-learn": "scikit-learn",
    numpy: "NumPy",
    pandas: "pandas",
    dbt: "dbt",
    llms: "LLMs",
    "soc 2": "SOC 2",
    "github actions": "GitHub Actions",
    "gitlab ci": "GitLab CI",
    circleci: "CircleCI",
    "power bi": "Power BI",
    matlab: "MATLAB",
    "bachelor's degree": "Bachelor's degree",
    "master's degree": "Master's degree",
    PhD: "PhD",
  };
  for (const [term, label] of Object.entries(expected)) assert.equal(skillLabel(term), label, term);
});

test("a term without an explicit name has each word capitalised", () => {
  assert.equal(skillLabel("docker"), "Docker");
  assert.equal(skillLabel("machine learning"), "Machine Learning");
  assert.equal(skillLabel("some new thing"), "Some New Thing");
  assert.equal(skillLabel(""), "");
  assert.equal(skillLabel(null), "");
});

test("every known skill has a label that is the same word in other casing or punctuation", () => {
  for (const key of Object.keys(SKILL_ALIASES)) {
    const label = skillLabel(key);
    assert.ok(label, key);
    assert.equal(plain(label), plain(key), `${key} -> ${label}`);
  }
});
