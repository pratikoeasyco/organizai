import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BoardProvider } from "@/components/kanban/BoardProvider";
import { BoardScreen } from "@/components/kanban/BoardScreen";
import { SkeletonBoard } from "@/components/ui/Skeleton";
import { requireUser } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors";
import { getBoard } from "@/server/services/board";
import { touchRecentProject } from "@/server/services/projects";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const { projectId } = await params;
  const user = await requireUser();
  try {
    const board = await getBoard(user.id, projectId);
    return { title: board.project.name };
  } catch {
    return { title: "Projeto" };
  }
}

export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();

  try {
    const board = await getBoard(user.id, projectId);
    // Alimenta "Projetos recentes"; falha aqui não impede abrir o quadro.
    await touchRecentProject(user.id, projectId);

    return (
      <BoardProvider initial={board}>
        <Suspense fallback={<SkeletonBoard />}>
          <BoardScreen />
        </Suspense>
      </BoardProvider>
    );
  } catch (error) {
    if (error instanceof AppError && (error.status === 404 || error.status === 403)) {
      notFound();
    }
    throw error;
  }
}
