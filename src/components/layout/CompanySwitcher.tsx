"use client";

import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Plus, Settings } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { readableTextOn } from "@/lib/utils/colors";
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from "@/components/ui/Dropdown";
import type { CompanySummary } from "@/server/services/companies";

export interface CompanySwitcherProps {
  companies: CompanySummary[];
  active: CompanySummary | null;
  collapsed?: boolean;
  onCreateCompany: () => void;
}

function CompanyBadge({ company, size = 28 }: { company: CompanySummary; size?: number }) {
  return (
    <span
      style={{
        backgroundColor: company.color,
        color: readableTextOn(company.color),
        width: size,
        height: size,
      }}
      className="flex shrink-0 items-center justify-center rounded-md text-[12px] font-semibold uppercase"
      aria-hidden="true"
    >
      {company.logoEmoji ?? company.name.slice(0, 1)}
    </span>
  );
}

export function CompanySwitcher({
  companies,
  active,
  collapsed,
  onCreateCompany,
}: CompanySwitcherProps) {
  const router = useRouter();

  return (
    <Dropdown
      align="start"
      width={264}
      trigger={({ ref, onClick, open, ...aria }) => (
        <button
          ref={ref}
          onClick={onClick}
          {...aria}
          aria-label={active ? `Empresa atual: ${active.name}` : "Selecionar empresa"}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface text-left transition-colors",
            "hover:border-line-strong hover:bg-surface-muted",
            open && "border-brand-600 ring-3 ring-brand-600/10",
            collapsed ? "justify-center p-1.5" : "px-2.5 py-2",
          )}
        >
          {active ? (
            <CompanyBadge company={active} />
          ) : (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-ink-faint">
              <Building2 className="size-4" />
            </span>
          )}

          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold leading-tight text-ink">
                  {active?.name ?? "Nenhuma empresa"}
                </span>
                <span className="block truncate text-[11.5px] leading-tight text-ink-faint">
                  {active ? "Empresa atual" : "Crie a primeira"}
                </span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-ink-faint" />
            </>
          )}
        </button>
      )}
    >
      {({ close }) => (
        <>
          <DropdownLabel>Empresas</DropdownLabel>

          <div className="max-h-64 overflow-y-auto scrollbar-slim">
            {companies.length === 0 && (
              <p className="px-2.5 py-2 text-[12.5px] text-ink-muted">
                Você ainda não tem empresas.
              </p>
            )}

            {companies.map((company) => (
              <button
                key={company.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  router.push(`/empresas/${company.slug}`);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-surface-sunken",
                  active?.id === company.id && "bg-brand-50",
                )}
              >
                <CompanyBadge company={company} size={24} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {company.name}
                  </span>
                  <span className="block truncate text-[11px] text-ink-faint">
                    {company.projectCount === 1
                      ? "1 projeto"
                      : `${company.projectCount} projetos`}
                  </span>
                </span>
                {active?.id === company.id && (
                  <Check className="size-3.5 shrink-0 text-brand-600" />
                )}
              </button>
            ))}
          </div>

          <DropdownSeparator />

          <DropdownItem
            icon={<Plus />}
            onSelect={() => {
              close();
              onCreateCompany();
            }}
          >
            Criar empresa
          </DropdownItem>

          {active && (
            <DropdownItem
              icon={<Settings />}
              onSelect={() => {
                close();
                router.push(`/empresas/${active.slug}/configuracoes`);
              }}
            >
              Configurações da empresa
            </DropdownItem>
          )}
        </>
      )}
    </Dropdown>
  );
}
