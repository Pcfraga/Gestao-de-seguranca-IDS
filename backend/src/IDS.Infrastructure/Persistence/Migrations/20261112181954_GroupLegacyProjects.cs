using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IDS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class GroupLegacyProjects : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CanonicalSiteId",
                table: "sites",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE sites AS s
                SET "CanonicalSiteId" = (
                    SELECT canonical."Id"
                    FROM sites canonical
                    WHERE canonical."TenantId" = s."TenantId"
                        AND UPPER(TRIM(canonical."Name")) = UPPER(TRIM(s."Name"))
                    ORDER BY canonical."Id"
                    LIMIT 1
                )
                WHERE s."Id" <> (
                    SELECT canonical."Id"
                    FROM sites canonical
                    WHERE canonical."TenantId" = s."TenantId"
                        AND UPPER(TRIM(canonical."Name")) = UPPER(TRIM(s."Name"))
                    ORDER BY canonical."Id"
                    LIMIT 1
                );
                CREATE UNIQUE INDEX "IX_sites_canonical_normalized_name"
                    ON sites ("TenantId", UPPER(TRIM("Name")))
                    WHERE "CanonicalSiteId" IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DROP INDEX "IX_sites_canonical_normalized_name";""");
            migrationBuilder.DropColumn(
                name: "CanonicalSiteId",
                table: "sites");
        }
    }
}
