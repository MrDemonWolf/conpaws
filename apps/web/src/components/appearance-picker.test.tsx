import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getMessages } from "@/i18n";
import { AppearancePicker } from "./appearance-picker";

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

describe("appearance picker", () => {
  it("keeps server markup stable until the saved preference can hydrate", () => {
    const html = renderToStaticMarkup(
      <AppearancePicker labels={getMessages("en").appearance} />,
    );
    expect(html).toContain("<label");
    expect(html).toContain("Appearance");
    expect(html).toContain('disabled=""');
    expect(html).toContain(
      '<option value="system" selected="">System</option>',
    );
    expect(html).toContain('<option value="light">Light</option>');
    expect(html).toContain('<option value="dark">Dark</option>');
  });
});
