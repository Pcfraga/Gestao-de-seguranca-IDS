using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IDS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCompanyIsolation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_sites_Name_ProjectOrIsland",
                table: "sites");

            migrationBuilder.DropIndex(
                name: "IX_organizations_Kind_Name",
                table: "organizations");

            migrationBuilder.DropIndex(
                name: "IX_monthly_ipf_records_ContractorOrganizationId_Year_Month",
                table: "monthly_ipf_records");

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                table: "sites",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("40000000-0000-0000-0000-000000000001"));

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                table: "report_settings",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("40000000-0000-0000-0000-000000000001"));

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                table: "organizations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("40000000-0000-0000-0000-000000000001"));

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                table: "monthly_ipf_records",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("40000000-0000-0000-0000-000000000001"));

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                table: "evaluations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("40000000-0000-0000-0000-000000000001"));

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                table: "evaluation_observations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("40000000-0000-0000-0000-000000000001"));

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                table: "audit_events",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("40000000-0000-0000-0000-000000000001"));

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                table: "AspNetUsers",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("40000000-0000-0000-0000-000000000001"));

            migrationBuilder.CreateTable(
                name: "tenants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenants", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "tenants",
                columns: new[] { "Id", "Name" },
                values: new object[] { new Guid("40000000-0000-0000-0000-000000000001"), "Empresa legada de testes" });

            migrationBuilder.CreateIndex(
                name: "IX_sites_TenantId_Name_ProjectOrIsland",
                table: "sites",
                columns: new[] { "TenantId", "Name", "ProjectOrIsland" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_report_settings_TenantId",
                table: "report_settings",
                column: "TenantId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_organizations_TenantId_Kind_Name",
                table: "organizations",
                columns: new[] { "TenantId", "Kind", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_monthly_ipf_records_ContractorOrganizationId",
                table: "monthly_ipf_records",
                column: "ContractorOrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year_~",
                table: "monthly_ipf_records",
                columns: new[] { "TenantId", "ContractorOrganizationId", "Year", "Month" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_evaluations_TenantId",
                table: "evaluations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_evaluation_observations_TenantId",
                table: "evaluation_observations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_audit_events_TenantId",
                table: "audit_events",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_TenantId",
                table: "AspNetUsers",
                column: "TenantId");

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_tenants_TenantId",
                table: "AspNetUsers",
                column: "TenantId",
                principalTable: "tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_audit_events_tenants_TenantId",
                table: "audit_events",
                column: "TenantId",
                principalTable: "tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_evaluation_observations_tenants_TenantId",
                table: "evaluation_observations",
                column: "TenantId",
                principalTable: "tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_evaluations_tenants_TenantId",
                table: "evaluations",
                column: "TenantId",
                principalTable: "tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_monthly_ipf_records_tenants_TenantId",
                table: "monthly_ipf_records",
                column: "TenantId",
                principalTable: "tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_organizations_tenants_TenantId",
                table: "organizations",
                column: "TenantId",
                principalTable: "tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_report_settings_tenants_TenantId",
                table: "report_settings",
                column: "TenantId",
                principalTable: "tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_sites_tenants_TenantId",
                table: "sites",
                column: "TenantId",
                principalTable: "tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            if (ActiveProvider == "Npgsql.EntityFrameworkCore.PostgreSQL")
            {
                foreach (var table in new[] { "AspNetUsers", "sites", "organizations", "evaluations",
                    "evaluation_observations", "monthly_ipf_records", "report_settings", "audit_events" })
                {
                    migrationBuilder.Sql($"ALTER TABLE \"{table}\" ALTER COLUMN \"TenantId\" DROP DEFAULT;");
                }
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_tenants_TenantId",
                table: "AspNetUsers");

            migrationBuilder.DropForeignKey(
                name: "FK_audit_events_tenants_TenantId",
                table: "audit_events");

            migrationBuilder.DropForeignKey(
                name: "FK_evaluation_observations_tenants_TenantId",
                table: "evaluation_observations");

            migrationBuilder.DropForeignKey(
                name: "FK_evaluations_tenants_TenantId",
                table: "evaluations");

            migrationBuilder.DropForeignKey(
                name: "FK_monthly_ipf_records_tenants_TenantId",
                table: "monthly_ipf_records");

            migrationBuilder.DropForeignKey(
                name: "FK_organizations_tenants_TenantId",
                table: "organizations");

            migrationBuilder.DropForeignKey(
                name: "FK_report_settings_tenants_TenantId",
                table: "report_settings");

            migrationBuilder.DropForeignKey(
                name: "FK_sites_tenants_TenantId",
                table: "sites");

            migrationBuilder.DropTable(
                name: "tenants");

            migrationBuilder.DropIndex(
                name: "IX_sites_TenantId_Name_ProjectOrIsland",
                table: "sites");

            migrationBuilder.DropIndex(
                name: "IX_report_settings_TenantId",
                table: "report_settings");

            migrationBuilder.DropIndex(
                name: "IX_organizations_TenantId_Kind_Name",
                table: "organizations");

            migrationBuilder.DropIndex(
                name: "IX_monthly_ipf_records_ContractorOrganizationId",
                table: "monthly_ipf_records");

            migrationBuilder.DropIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year_~",
                table: "monthly_ipf_records");

            migrationBuilder.DropIndex(
                name: "IX_evaluations_TenantId",
                table: "evaluations");

            migrationBuilder.DropIndex(
                name: "IX_evaluation_observations_TenantId",
                table: "evaluation_observations");

            migrationBuilder.DropIndex(
                name: "IX_audit_events_TenantId",
                table: "audit_events");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_TenantId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "sites");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "report_settings");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "monthly_ipf_records");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "evaluations");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "evaluation_observations");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "audit_events");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "AspNetUsers");

            migrationBuilder.CreateIndex(
                name: "IX_sites_Name_ProjectOrIsland",
                table: "sites",
                columns: new[] { "Name", "ProjectOrIsland" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_organizations_Kind_Name",
                table: "organizations",
                columns: new[] { "Kind", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_monthly_ipf_records_ContractorOrganizationId_Year_Month",
                table: "monthly_ipf_records",
                columns: new[] { "ContractorOrganizationId", "Year", "Month" },
                unique: true);
        }
    }
}
