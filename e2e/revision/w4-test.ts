import { expect, test as base, type Page } from "@playwright/test";

function attachErrorGuards(page: Page, errors: string[]): void {
  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // Chromium also emits "Failed to load resource" for HTTP responses such
    // as the expected 401/403 auth and RBAC probes and intentional 4xx cases.
    // Those are transport diagnostics, not JavaScript console.error calls;
    // the individual E2E assertions verify their response and UI behavior.
    if (message.text().startsWith("Failed to load resource:")) return;
    const location = message.location();
    errors.push(
      `console.error at ${location.url || page.url()}:${location.lineNumber}:${location.columnNumber}: ${message.text()}`,
    );
  });
}

export const test = base.extend<{ w4BrowserErrorGuard: void }>({
  w4BrowserErrorGuard: [
    async ({ page, context }, use, testInfo) => {
      const errors: string[] = [];
      const attach = (openedPage: Page) => attachErrorGuards(openedPage, errors);
      attach(page);
      context.on("page", attach);

      await use();

      context.off("page", attach);
      if (errors.length > 0) {
        await testInfo.attach("browser-errors", {
          body: errors.join("\n"),
          contentType: "text/plain",
        });
      }
      expect(errors, `${testInfo.title}: errores de consola o pageerror`).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
