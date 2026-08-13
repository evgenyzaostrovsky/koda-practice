import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { ProfilePage } from "./ProfilePage";
vi.mock("./auth", () => ({ useAuth: () => ({ user: { id: "u1", email: "very.long.email.address@example.com", created_at: "2026-01-01", user_metadata: {} } }) }));
vi.mock("./cloud-sync", () => ({ loadProfile: vi.fn().mockResolvedValue({ user_id: "u1", display_name: "Очень длинное имя пользователя для проверки переноса", username: "long_username", created_at: "2026-01-01", updated_at: "2026-01-01", last_active_at: "2026-08-13" }), loadAttempts: vi.fn().mockResolvedValue([]), updateProfileIdentity: vi.fn() }));
vi.mock("./api", () => ({ api: vi.fn().mockResolvedValue({ solved: 6, total: 200, attempts: 9, modules: [{ slug: "pandas", title: "Основы pandas", solved: 3, total: 10, mastery: 30 }], activity: [] }) }));
vi.mock("./achievements/ProfileAchievements", () => ({ ProfileAchievements: () => <section>Достижения preview</section> }));
beforeEach(() => localStorage.clear());
it("renders a compact navigation overview without the full topic list", async () => {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><ProfilePage /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole("heading", { name: "Очень длинное имя пользователя для проверки переноса", level: 1 })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Прогресс/ })).toHaveAttribute("href", "/progress");
  expect(screen.getByRole("link", { name: /Активность/ })).toHaveAttribute("href", "/profile/history");
  expect(screen.getByRole("link", { name: /Аккаунт/ })).toHaveAttribute("href", "/profile/settings");
  expect(screen.queryByText("20 тем")).not.toBeInTheDocument();
  expect(screen.getByText("История решений пока пуста")).toBeInTheDocument();
});
