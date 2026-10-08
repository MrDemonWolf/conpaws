import { securityHeaders } from "../src/lib/csp";

const target = process.argv[2];
if (!target) {
  console.warn("::warning::Usage: bun scripts/check-headers.ts <url>");
} else {
  try {
    const response = await fetch(target, {
      method: "HEAD",
      redirect: "follow",
    });
    const differences = securityHeaders("production").flatMap(
      ({ key, value }) => {
        const actual = response.headers.get(key);
        return actual === value
          ? []
          : [
              `${key}: expected ${JSON.stringify(value)}, received ${JSON.stringify(actual)}`,
            ];
      },
    );

    if (differences.length) {
      for (const difference of differences) {
        console.warn(
          `::warning::${response.url} security header mismatch: ${difference}`,
        );
      }
    } else {
      console.log(`Security headers match for ${response.url}`);
    }
  } catch (error) {
    console.warn(`::warning::Security header check failed: ${String(error)}`);
  }
}
