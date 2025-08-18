-- CreateTable
CREATE TABLE "public"."Solicitacao" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "solicitanteId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Solicitacao_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Solicitacao" ADD CONSTRAINT "Solicitacao_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
