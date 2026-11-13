import assert from "node:assert/strict";
import { test } from "node:test";
import { checkRewrite, technologies } from "@/server/resume/guardrails";

test("ordinary words that are also technology names are not an added technology", () => {
  const cases = [
    ["Helped the team do well on launches", "Led the team to excel at product launches"],
    ["Started a new mentoring program", "Sparked a mentoring program for new hires"],
    ["Paid for tooling out of the team budget", "Agreed to shell out for tooling from the team budget"],
    ["Kept the teams working together", "Kept unity across the teams during the merger"],
    ["Answered customer emails quickly", "Gave a swift response to customer emails"],
  ];
  for (const [original, rewrite] of cases) {
    assert.deepEqual([...technologies(rewrite)], [], rewrite);
    assert.equal(checkRewrite(original, rewrite, { allowCuts: true }), rewrite, rewrite);
  }
});

test("an added technology is still caught, including new and ambiguous names", () => {
  const original = "Built reporting dashboards for the finance team";
  for (const rewrite of [
    "Built Tableau reporting dashboards for the finance team",
    "Built reporting dashboards in Excel for the finance team",
    "Built reporting dashboards on Spark for the finance team",
    "Built Python reporting dashboards for the finance team",
    "Built reporting dashboards with python and pandas for the finance team",
    "Built reporting dashboards in Go for the finance team",
    "Built Snowflake reporting dashboards for the finance team",
  ]) {
    assert.equal(checkRewrite(original, rewrite, { allowCuts: true }), null, rewrite);
  }
});

test("a swapped or dropped technology is caught; the same one under another spelling is kept", () => {
  const original = "Built PostgreSQL and Kafka pipelines for billing";
  assert.equal(checkRewrite(original, "Built MySQL and Kafka pipelines for billing"), null);
  assert.equal(checkRewrite(original, "Built Kafka pipelines for billing"), null);
  assert.equal(checkRewrite(original, "Engineered Postgres and Kafka pipelines for billing"), "Engineered Postgres and Kafka pipelines for billing");
});

test("ways of working are not treated as technologies", () => {
  assert.deepEqual([...technologies("Improved concurrency and system design with unit testing")], []);
  assert.deepEqual([...technologies("Shipped an iOS app in SwiftUI with Core Data")].sort(), ["core data", "ios", "swiftui"]);
});
