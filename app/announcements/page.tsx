import Link from "next/link";
import { cse, asArray, pick } from "@/lib/cse";

export const revalidate = 300;

const tabs: Record<string, [string, string]> = {
  financial: ["getFinancialAnnouncement", "Financial"],
  approved: ["approvedAnnouncement", "Approved"],
  circular: ["circularAnnouncement", "Circulars"],
  directive: ["directiveAnnouncement", "Directives"],
  listings: ["getNewListingsRelatedNoticesAnnouncements", "New listings"],
  buyin: ["getBuyInBoardAnnouncements", "Buy-in board"],
  noncompliance: ["getNonComplianceAnnouncements", "Non-compliance"],
  covid: ["getCOVIDAnnouncements", "COVID"],
};

export default async function Announcements({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const type =
    searchParams.type && tabs[searchParams.type]
      ? searchParams.type
      : "financial";
  const rows = asArray(await cse(tabs[type][0], {}, 300));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Announcements</h1>
      <nav className="flex flex-wrap gap-2">
        {Object.entries(tabs).map(([k, [, label]]) => (
          <Link
            key={k}
            href={`/announcements?type=${k}`}
            aria-current={k === type ? "page" : undefined}
            className={`px-3 py-1 text-sm rounded-md border ${k === type ? "bg-ink text-white border-ink" : "border-line bg-white hover:bg-paper"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <ul className="panel divide-y divide-line">
        {rows.length === 0 && (
          <li className="p-3 text-sm text-muted">
            Nothing returned for this category.
          </li>
        )}
        {rows.slice(0, 50).map((r, i) => {
          const title =
            pick(
              r,
              "fileText",
              "announcementTitle",
              "title",
              "subject",
              "name",
              "category",
            ) ?? "Announcement";
          const company = pick(r, "company", "symbol", "companyName");
          const date = pick(
            r,
            "dateOfAnnouncement",
            "date",
            "createdDate",
            "publishDate",
          );
          const path = pick(r, "path", "url", "link");
          const href =
            typeof path === "string"
              ? path.startsWith("http")
                ? path
                : `https://cdn.cse.lk/${path.replace(/^\/+/, "")}`
              : undefined;
          return (
            <li key={i} className="p-3 text-sm">
              <div className="font-medium">
                {href ? (
                  <a
                    className="text-sea hover:underline"
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {String(title)}
                  </a>
                ) : (
                  String(title)
                )}
              </div>
              <div className="text-muted">
                {[company, date].filter(Boolean).join(" · ")}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
