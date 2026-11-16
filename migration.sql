CREATE TABLE "celebracoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"data" text NOT NULL UNIQUE,
	"celebracao" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "musicas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"repertorio" uuid NOT NULL,
	"titulo" text NOT NULL,
	"momento" text NOT NULL,
	"tom" text DEFAULT '' NOT NULL,
	"letra" text DEFAULT '' NOT NULL,
	"cifra_texto" text DEFAULT '' NOT NULL,
	"audio" text DEFAULT '' NOT NULL,
	"cifra" text DEFAULT '' NOT NULL,
	"partitura" text DEFAULT '' NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "musicas" ADD CONSTRAINT "musicas_repertorio_celebracoes_id_fkey" FOREIGN KEY ("repertorio") REFERENCES "celebracoes"("id") ON DELETE CASCADE;
--> statement-breakpoint
INSERT INTO celebracoes (data, celebracao) VALUES ('2026-11-15', '33º Domingo do Tempo Comum'), ('2026-11-22', 'Solenidade de Nosso Senhor Jesus Cristo, Rei do Universo') ON CONFLICT DO NOTHING;
