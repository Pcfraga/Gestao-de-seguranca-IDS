using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IDS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectMonthlyIpf : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year_~",
                table: "monthly_ipf_records");

            migrationBuilder.DropIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year~1",
                table: "monthly_ipf_records");

            migrationBuilder.DropIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year~2",
                table: "monthly_ipf_records");

            migrationBuilder.DropIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year~3",
                table: "monthly_ipf_records");

            migrationBuilder.AddColumn<decimal>(
                name: "IdsAverage",
                table: "monthly_ipf_records",
                type: "numeric(28,16)",
                precision: 28,
                scale: 16,
                nullable: true);

            // The previous indexes allowed only one record per contractor/month/scope,
            // so canonicalizing an existing alias cannot merge two records.
            migrationBuilder.Sql("""
                UPDATE monthly_ipf_records AS record
                SET "SiteId" = site."CanonicalSiteId"
                FROM sites AS site
                INNER JOIN sites AS canonical ON canonical."Id" = site."CanonicalSiteId"
                    AND canonical."TenantId" = site."TenantId"
                    AND canonical."CanonicalSiteId" IS NULL
                WHERE record."SiteId" = site."Id" AND record."TenantId" = site."TenantId";
                """);

            migrationBuilder.CreateIndex(
                name: "IX_ipf_project",
                table: "monthly_ipf_records",
                columns: new[] { "TenantId", "ContractorOrganizationId", "Year", "Month", "SiteId" },
                unique: true,
                filter: "\"SiteId\" IS NOT NULL AND \"AreaId\" IS NULL AND \"FormId\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ipf_project_area",
                table: "monthly_ipf_records",
                columns: new[] { "TenantId", "ContractorOrganizationId", "Year", "Month", "SiteId", "AreaId" },
                unique: true,
                filter: "\"SiteId\" IS NOT NULL AND \"AreaId\" IS NOT NULL AND \"FormId\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ipf_project_area_form",
                table: "monthly_ipf_records",
                columns: new[] { "TenantId", "ContractorOrganizationId", "Year", "Month", "SiteId", "AreaId", "FormId" },
                unique: true,
                filter: "\"SiteId\" IS NOT NULL AND \"AreaId\" IS NOT NULL AND \"FormId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ipf_project_form",
                table: "monthly_ipf_records",
                columns: new[] { "TenantId", "ContractorOrganizationId", "Year", "Month", "SiteId", "FormId" },
                unique: true,
                filter: "\"SiteId\" IS NOT NULL AND \"AreaId\" IS NULL AND \"FormId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year_~",
                table: "monthly_ipf_records",
                columns: new[] { "TenantId", "ContractorOrganizationId", "Year", "Month" },
                unique: true,
                filter: "\"SiteId\" IS NULL AND \"AreaId\" IS NULL AND \"FormId\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year~1",
                table: "monthly_ipf_records",
                columns: new[] { "TenantId", "ContractorOrganizationId", "Year", "Month", "AreaId" },
                unique: true,
                filter: "\"SiteId\" IS NULL AND \"AreaId\" IS NOT NULL AND \"FormId\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year~2",
                table: "monthly_ipf_records",
                columns: new[] { "TenantId", "ContractorOrganizationId", "Year", "Month", "FormId" },
                unique: true,
                filter: "\"SiteId\" IS NULL AND \"AreaId\" IS NULL AND \"FormId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year~3",
                table: "monthly_ipf_records",
                columns: new[] { "TenantId", "ContractorOrganizationId", "Year", "Month", "AreaId", "FormId" },
                unique: true,
                filter: "\"SiteId\" IS NULL AND \"AreaId\" IS NOT NULL AND \"FormId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ipf_project",
                table: "monthly_ipf_records");

            migrationBuilder.DropIndex(
                name: "IX_ipf_project_area",
                table: "monthly_ipf_records");

            migrationBuilder.DropIndex(
                name: "IX_ipf_project_area_form",
                table: "monthly_ipf_records");

            migrationBuilder.DropIndex(
                name: "IX_ipf_project_form",
                table: "monthly_ipf_records");

            migrationBuilder.DropIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year_~",
                table: "monthly_ipf_records");

            migrationBuilder.DropIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year~1",
                table: "monthly_ipf_records");

            migrationBuilder.DropIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year~2",
                table: "monthly_ipf_records");

            migrationBuilder.DropIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year~3",
                table: "monthly_ipf_records");

            migrationBuilder.DropColumn(
                name: "IdsAverage",
                table: "monthly_ipf_records");

            migrationBuilder.CreateIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year_~",
                table: "monthly_ipf_records",
                columns: new[] { "TenantId", "ContractorOrganizationId", "Year", "Month" },
                unique: true,
                filter: "\"AreaId\" IS NULL AND \"FormId\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year~1",
                table: "monthly_ipf_records",
                columns: new[] { "TenantId", "ContractorOrganizationId", "Year", "Month", "AreaId" },
                unique: true,
                filter: "\"AreaId\" IS NOT NULL AND \"FormId\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year~2",
                table: "monthly_ipf_records",
                columns: new[] { "TenantId", "ContractorOrganizationId", "Year", "Month", "FormId" },
                unique: true,
                filter: "\"AreaId\" IS NULL AND \"FormId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year~3",
                table: "monthly_ipf_records",
                columns: new[] { "TenantId", "ContractorOrganizationId", "Year", "Month", "AreaId", "FormId" },
                unique: true,
                filter: "\"AreaId\" IS NOT NULL AND \"FormId\" IS NOT NULL");
        }
    }
}
