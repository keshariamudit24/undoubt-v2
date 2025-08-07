-- CreateTable
CREATE TABLE "public"."Doubts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "room" TEXT NOT NULL,
    "doubt" TEXT NOT NULL,

    CONSTRAINT "Doubts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Doubts" ADD CONSTRAINT "Doubts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
