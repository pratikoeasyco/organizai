"use client";

import { useState } from "react";
import { Building2, Plus } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { CompanyFormModal } from "@/components/companies/CompanyFormModal";
import { ProjectFormModal } from "@/components/projects/ProjectFormModal";

export interface CreateEntityButtonsProps {
  companyId: string | null;
  /** Só o botão de criar empresa (empty state inicial). */
  primaryOnly?: boolean;
  /** Só o botão de criar projeto. */
  projectOnly?: boolean;
}

export function CreateEntityButtons({
  companyId,
  primaryOnly,
  projectOnly,
}: CreateEntityButtonsProps) {
  const [companyModal, setCompanyModal] = useState(false);
  const [projectModal, setProjectModal] = useState(false);

  return (
    <>
      {!projectOnly && (
        <Button
          variant={primaryOnly ? "primary" : "secondary"}
          size={primaryOnly ? "lg" : "md"}
          leftIcon={<Building2 className="size-4" />}
          onClick={() => setCompanyModal(true)}
        >
          {primaryOnly ? "Criar empresa" : "Nova empresa"}
        </Button>
      )}

      {!primaryOnly && companyId && (
        <Button
          variant="primary"
          leftIcon={<Plus className="size-4" />}
          onClick={() => setProjectModal(true)}
        >
          Novo projeto
        </Button>
      )}

      <CompanyFormModal open={companyModal} onClose={() => setCompanyModal(false)} />
      {companyId && (
        <ProjectFormModal
          open={projectModal}
          onClose={() => setProjectModal(false)}
          companyId={companyId}
        />
      )}
    </>
  );
}
