import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KnowledgeArticle, KnowledgeIndex } from "./Knowledge";
import { api } from "./api";

const unit = {
  id: "ku-groupby",
  slug: "groupby",
  topicId: "10",
  title: "Группировка",
  description: "Группировка и агрегация данных",
  category: "pandas",
  concepts: ["groupby"],
  methods: ["groupby", "sum"],
  functions: [],
  attributes: [],
  operators: [],
  keywords: ["группировка", "groupby"],
  cheatSheet: {
    entries: [
      {
        id: "cheat-groupby-001",
        group: "Группировка",
        name: ".groupby().sum()",
        kind: "pattern",
        description: "Суммирует значения внутри каждой группы.",
        example: "orders.groupby('region').sum()",
        documentationUrl:
          "https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.groupby.html",
      },
    ],
  },
  article: {
    lead: "Подробное объяснение группировки",
    sections: [
      {
        id: "method-1",
        title: "groupby",
        paragraphs: ["Метод разделяет данные."],
        covers: ["cheat-groupby-001"],
        syntax: "df.groupby('city')",
        examples: [
          {
            code: "orders.groupby('region').sum()",
            result: "Суммы по регионам",
            explanation: "Группирует строки",
          },
        ],
        errors: [],
        nuances: [],
      },
    ],
    summary: "Группировка освоена",
  },
  documentationLinks: [],
  relatedTaskIds: ["groupby-001"],
  version: 1,
};
const progress = {
  solved: 0,
  solved_ids: [],
  total: 200,
  attempts: 0,
  first_try_accuracy: 0,
  independent_rate: 0,
  hints_used: 0,
  xp: 0,
  due: 0,
  modules: [],
  activity: [],
  recent_errors: [],
};
vi.mock("./api", () => ({
  api: vi.fn((path: string) =>
    Promise.resolve(
      path === "/knowledge" ? [unit] : path === "/progress" ? progress : unit,
    ),
  ),
}));
const wrap = (ui: React.ReactNode, route = "/knowledge") =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );

describe("knowledge base", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    vi.mocked(api).mockImplementation((path: string) => Promise.resolve(path === "/modules" ? [] : path === "/knowledge" ? [unit] : path === "/progress" ? progress : unit) as ReturnType<typeof api>);
  });
  it("exposes loaded SQL, Excel and Power BI category filters without mixing their units", async () => {
    const extra = ["SQL", "Excel", "Power BI"].map(category => ({ ...unit, id: `ku-${category}`, slug: category, title: `${category} урок`, category }));
    vi.mocked(api).mockImplementation((path: string) => Promise.resolve(path === "/modules" ? [] : path === "/knowledge" ? [unit, ...extra] : progress) as ReturnType<typeof api>);
    wrap(<KnowledgeIndex />);
    await screen.findByText("SQL урок");
    for (const category of ["SQL", "Excel", "Power BI"]) {
      fireEvent.click(screen.getByRole("button", { name: category }));
      expect(screen.getByText(`${category} урок`)).toBeInTheDocument();
      expect(screen.queryByText("Группировка")).not.toBeInTheDocument();
      for (const other of extra.filter(item => item.category !== category)) expect(screen.queryByText(other.title)).not.toBeInTheDocument();
    }
  });
  it("searches real material and filters libraries", async () => {
    wrap(<KnowledgeIndex />);
    expect(await screen.findByText("Группировка")).toBeInTheDocument();
    fireEvent.change(
      screen.getByPlaceholderText("Тема, метод, функция или ключевое слово"),
      { target: { value: "groupby" } },
    );
    expect(screen.getByText("Группировка")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "NumPy" }));
    expect(
      screen.getByText("Материалы по этому запросу не найдены."),
    ).toBeInTheDocument();
  });
  it("switches reading modes without navigation and remembers the choice", async () => {
    wrap(
      <Routes>
        <Route path="/knowledge/:articleSlug" element={<KnowledgeArticle />} />
      </Routes>,
      "/knowledge/groupby",
    );
    expect(await screen.findByText(".groupby().sum()")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Статья" }));
    expect(
      screen.getByText("Подробное объяснение группировки"),
    ).toBeInTheDocument();
    expect(localStorage.getItem("koda:knowledge-mode")).toBe("article");
  });
  it("searches and copies compact cheat-sheet entries", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    wrap(
      <Routes>
        <Route path="/knowledge/:articleSlug" element={<KnowledgeArticle />} />
      </Routes>,
      "/knowledge/groupby",
    );
    await screen.findByText(".groupby().sum()");
    fireEvent.change(screen.getByLabelText("Поиск по шпаргалке"), {
      target: { value: "суммирует" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Копировать пример: .groupby().sum()",
      }),
    );
    expect(writeText).toHaveBeenCalledWith("orders.groupby('region').sum()");
  });
  it("links article sections and visible cheat groups to existing targets in the contextual navigation",async()=>{
    const expanded={...unit,cheatSheet:{entries:[...unit.cheatSheet.entries,{...unit.cheatSheet.entries[0],id:'cheat-check',group:'Проверка',name:'.size()',description:'Подсчитывает строки.'}]},article:{...unit.article,sections:[...unit.article.sections,{...unit.article.sections[0],id:'check-section',title:'Проверка результата'}]}};
    vi.mocked(api).mockImplementation((path:string)=>Promise.resolve(path==='/modules'?[]:path==='/knowledge'?[expanded]:path==='/progress'?progress:expanded) as ReturnType<typeof api>);
    wrap(<Routes><Route path="/knowledge/:articleSlug" element={<KnowledgeArticle/>}/></Routes>,'/knowledge/groupby');
    const nav=await screen.findByRole('complementary',{name:'Навигация по материалу'});
    for(const link of within(nav).getAllByRole('link')){const href=link.getAttribute('href')!;if(href.startsWith('#'))expect(document.getElementById(href.slice(1))).not.toBeNull();}
    expect(within(nav).getByRole('link',{name:'Проверка'})).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Поиск по шпаргалке'),{target:{value:'суммирует'}});expect(within(nav).queryByRole('link',{name:'Проверка'})).not.toBeInTheDocument();expect(within(nav).getByRole('link',{name:'Группировка'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Статья'}));for(const section of expanded.article.sections){expect(within(nav).getByRole('link',{name:section.title})).toHaveAttribute('href',`#${section.id}`);expect(document.getElementById(section.id)).not.toBeNull();}
  });
  it("offers only existing other materials from the same declared category",async()=>{
    const same={...unit,id:'ku-filter',slug:'filter',title:'Фильтрация'},other={...unit,id:'ku-numpy',slug:'arrays',title:'Массивы',category:'NumPy'};
    vi.mocked(api).mockImplementation((path:string)=>Promise.resolve(path==='/modules'?[]:path==='/knowledge'?[unit,same,other]:path==='/progress'?progress:unit) as ReturnType<typeof api>);
    wrap(<Routes><Route path="/knowledge/:articleSlug" element={<KnowledgeArticle/>}/></Routes>,'/knowledge/groupby');
    const nav=await screen.findByRole('complementary',{name:'Навигация по материалу'});expect(await within(nav).findByRole('link',{name:'Фильтрация'})).toHaveAttribute('href','/knowledge/filter');expect(within(nav).queryByRole('link',{name:'Массивы'})).not.toBeInTheDocument();expect(within(nav).queryByRole('link',{name:'Группировка'})).toHaveAttribute('href','#cheat-group-cheat-groupby-001');
  });
});
