using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IDS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LinkEvaluationIslands : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "IslandId",
                table: "evaluations",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql("""
                INSERT INTO inspection_islands
                    ("Id", "TenantId", "Name", "IsActive", "CreatedAtUtc", "UpdatedAtUtc")
                SELECT chosen."Id", chosen."TenantId", TRIM(chosen."ProjectOrIsland"), TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                FROM (
                    SELECT s."Id", s."TenantId", s."ProjectOrIsland",
                        ROW_NUMBER() OVER (PARTITION BY s."TenantId", UPPER(TRIM(s."ProjectOrIsland")) ORDER BY s."Id") AS rank
                    FROM sites s
                    WHERE s."ProjectOrIsland" IS NOT NULL AND TRIM(s."ProjectOrIsland") <> ''
                ) chosen
                WHERE chosen.rank = 1;

                UPDATE evaluations AS e
                SET "IslandId" = (
                    SELECT i."Id" FROM sites s
                    JOIN inspection_islands i ON i."TenantId" = s."TenantId"
                        AND UPPER(i."Name") = UPPER(TRIM(s."ProjectOrIsland"))
                    WHERE e."SiteId" = s."Id" AND e."TenantId" = s."TenantId"
                    LIMIT 1
                );
                """);

            migrationBuilder.CreateIndex(
                name: "IX_evaluations_IslandId_EvaluationDate",
                table: "evaluations",
                columns: new[] { "IslandId", "EvaluationDate" });

            migrationBuilder.AddForeignKey(
                name: "FK_evaluations_inspection_islands_IslandId",
                table: "evaluations",
                column: "IslandId",
                principalTable: "inspection_islands",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_evaluations_inspection_islands_IslandId",
                table: "evaluations");

            migrationBuilder.DropIndex(
                name: "IX_evaluations_IslandId_EvaluationDate",
                table: "evaluations");

            migrationBuilder.DropColumn(
                name: "IslandId",
                table: "evaluations");
        }
    }
}
