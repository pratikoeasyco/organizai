"use client";

import Link from "next/link";
import { FolderKanban, Users } from "lucide-react";

import { formatRelative } from "@/lib/utils/format";
import { readableTextOn } from "@/lib/utils/colors";
import { ROLE_LABEL } from "@/types/domain";
import type { CompanySummary } from "@/server/services/companies";

export function CompanyCard({ company }: { company: CompanySummary }) {
  return (
    <Link
      href={`/empresas/${company.slug}`}
      className="card-surface group flex flex-col p-4 transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-line-strong hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          style={{ backgroundColor: company.color, color: readableTextOn(company.color) }}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[17px] font-semibold uppercase"
        >
          {company.logoEmoji ?? company.name.slice(0, 1)}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold leading-tight text-ink">
            {company.name}
          </h3>
          <p className="mt-1 truncate text-[12.5px] text-ink-faint">
            /{company.slug} · {ROLE_LABEL[company.role]}
          </p>
        </div>
      </div>

      <dl className="mt-5 flex items-center gap-4 text-[12.5px] text-ink-muted">
        <div className="flex items-center gap-1.5">
          <FolderKanban className="size-3.5 text-ink-faint" aria-hidden="true" />
          <dt className="sr-only">Projetos</dt>
          <dd>
            {company.projectCount === 1 ? "1 projeto" : `${company.projectCount} projetos`}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="size-3.5 text-ink-faint" aria-hidden="true" />
          <dt className="sr-only">Membros</dt>
          <dd>{company.memberCount === 1 ? "1 membro" : `${company.memberCount} membros`}</dd>
        </div>
      </dl>

      <p className="mt-3 border-t border-line pt-3 text-[11.5px] text-ink-faint">
        {company.lastActivityAt
          ? `Última atividade ${formatRelative(company.lastActivityAt)}`
          : `Criada ${formatRelative(company.createdAt)}`}
      </p>
    </Link>
  );
}
