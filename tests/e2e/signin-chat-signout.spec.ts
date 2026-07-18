import { expect, test } from "@playwright/test";

test("a new account can sign up, chat, and sign out", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = "hunter2pass";

  await page.goto("/signup");
  await page.fill("#signup-email", email);
  await page.fill("#signup-password", password);
  await page.click("button:has-text('Sign up')");
  await expect(page).toHaveURL(/\/chat$/);

  await page.waitForSelector(".connection-status.open", { state: "attached", timeout: 15000 });

  await page.fill(".conversation-create input", "e2e conversation");
  await page.click(".conversation-create button");
  await page.waitForSelector(".conversation-list li.active", { state: "attached" });

  await page.fill("textarea", "Hello from the e2e suite");
  await page.click("button:has-text('Send')");

  await page.waitForSelector(".message.assistant", { timeout: 30000 });
  await expect(page.locator(".message.user .message-content").last()).toHaveText("Hello from the e2e suite");

  await page.click("text=Sign out");
  await expect(page).toHaveURL(/\/signout$/);
  await expect(page.getByRole("heading", { name: "Signed out" })).toBeVisible();

  await page.goto("/chat");
  await expect(page).toHaveURL(/\/signin$/);
});
