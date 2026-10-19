using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IDS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInspectionAreas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year_~",
                table: "monthly_ipf_records");

            migrationBuilder.AddColumn<Guid>(
                name: "AreaId",
                table: "monthly_ipf_records",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FormId",
                table: "monthly_ipf_records",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AreaId",
                table: "inspection_form_versions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AreaName",
                table: "inspection_form_versions",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "Saúde e Segurança do Trabalho");

            migrationBuilder.CreateTable(
                name: "inspection_areas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inspection_areas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_inspection_areas_tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_monthly_ipf_records_AreaId",
                table: "monthly_ipf_records",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_monthly_ipf_records_FormId",
                table: "monthly_ipf_records",
                column: "FormId");

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

            migrationBuilder.CreateIndex(
                name: "IX_inspection_form_versions_AreaId",
                table: "inspection_form_versions",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_inspection_areas_TenantId_Name",
                table: "inspection_areas",
                columns: new[] { "TenantId", "Name" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_inspection_form_versions_inspection_areas_AreaId",
                table: "inspection_form_versions",
                column: "AreaId",
                principalTable: "inspection_areas",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_monthly_ipf_records_inspection_areas_AreaId",
                table: "monthly_ipf_records",
                column: "AreaId",
                principalTable: "inspection_areas",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_monthly_ipf_records_inspection_forms_FormId",
                table: "monthly_ipf_records",
                column: "FormId",
                principalTable: "inspection_forms",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_inspection_form_versions_inspection_areas_AreaId",
                table: "inspection_form_versions");

            migrationBuilder.DropForeignKey(
                name: "FK_monthly_ipf_records_inspection_areas_AreaId",
                table: "monthly_ipf_records");

            migrationBuilder.DropForeignKey(
                name: "FK_monthly_ipf_records_inspection_forms_FormId",
                table: "monthly_ipf_records");

            migrationBuilder.DropTable(
                name: "inspection_areas");

            migrationBuilder.DropIndex(
                name: "IX_monthly_ipf_records_AreaId",
                table: "monthly_ipf_records");

            migrationBuilder.DropIndex(
                name: "IX_monthly_ipf_records_FormId",
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

            migrationBuilder.DropIndex(
                name: "IX_inspection_form_versions_AreaId",
                table: "inspection_form_versions");

            migrationBuilder.DropColumn(
                name: "AreaId",
                table: "monthly_ipf_records");

            migrationBuilder.DropColumn(
                name: "FormId",
                table: "monthly_ipf_records");

            migrationBuilder.DropColumn(
                name: "AreaId",
                table: "inspection_form_versions");

            migrationBuilder.DropColumn(
                name: "AreaName",
                table: "inspection_form_versions");

            migrationBuilder.CreateIndex(
                name: "IX_monthly_ipf_records_TenantId_ContractorOrganizationId_Year_~",
                table: "monthly_ipf_records",
                columns: new[] { "TenantId", "ContractorOrganizationId", "Year", "Month" },
                unique: true);
        }
    }
}
