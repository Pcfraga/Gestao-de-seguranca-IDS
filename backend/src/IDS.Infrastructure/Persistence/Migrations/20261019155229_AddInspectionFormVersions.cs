using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IDS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInspectionFormVersions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "FormVersionId",
                table: "observation_categories",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FormVersionId",
                table: "evaluations",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "inspection_forms",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    CurrentVersion = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inspection_forms", x => x.Id);
                    table.ForeignKey(
                        name: "FK_inspection_forms_tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "inspection_form_versions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FormId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    UpdatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inspection_form_versions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_inspection_form_versions_inspection_forms_FormId",
                        column: x => x.FormId,
                        principalTable: "inspection_forms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inspection_form_versions_tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.UpdateData(
                table: "observation_categories",
                keyColumn: "Id",
                keyValue: new Guid("10000000-0000-0000-0000-000000000001"),
                column: "FormVersionId",
                value: null);

            migrationBuilder.UpdateData(
                table: "observation_categories",
                keyColumn: "Id",
                keyValue: new Guid("10000000-0000-0000-0000-000000000002"),
                column: "FormVersionId",
                value: null);

            migrationBuilder.UpdateData(
                table: "observation_categories",
                keyColumn: "Id",
                keyValue: new Guid("10000000-0000-0000-0000-000000000003"),
                column: "FormVersionId",
                value: null);

            migrationBuilder.UpdateData(
                table: "observation_categories",
                keyColumn: "Id",
                keyValue: new Guid("10000000-0000-0000-0000-000000000004"),
                column: "FormVersionId",
                value: null);

            migrationBuilder.UpdateData(
                table: "observation_categories",
                keyColumn: "Id",
                keyValue: new Guid("10000000-0000-0000-0000-000000000005"),
                column: "FormVersionId",
                value: null);

            migrationBuilder.UpdateData(
                table: "observation_categories",
                keyColumn: "Id",
                keyValue: new Guid("10000000-0000-0000-0000-000000000006"),
                column: "FormVersionId",
                value: null);

            migrationBuilder.CreateIndex(
                name: "IX_observation_categories_FormVersionId",
                table: "observation_categories",
                column: "FormVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_evaluations_FormVersionId",
                table: "evaluations",
                column: "FormVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_inspection_form_versions_FormId_Version",
                table: "inspection_form_versions",
                columns: new[] { "FormId", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_inspection_form_versions_TenantId",
                table: "inspection_form_versions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_inspection_forms_TenantId",
                table: "inspection_forms",
                column: "TenantId",
                unique: true,
                filter: "\"IsDefault\" = true");

            migrationBuilder.AddForeignKey(
                name: "FK_evaluations_inspection_form_versions_FormVersionId",
                table: "evaluations",
                column: "FormVersionId",
                principalTable: "inspection_form_versions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_observation_categories_inspection_form_versions_FormVersion~",
                table: "observation_categories",
                column: "FormVersionId",
                principalTable: "inspection_form_versions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_evaluations_inspection_form_versions_FormVersionId",
                table: "evaluations");

            migrationBuilder.DropForeignKey(
                name: "FK_observation_categories_inspection_form_versions_FormVersion~",
                table: "observation_categories");

            migrationBuilder.DropTable(
                name: "inspection_form_versions");

            migrationBuilder.DropTable(
                name: "inspection_forms");

            migrationBuilder.DropIndex(
                name: "IX_observation_categories_FormVersionId",
                table: "observation_categories");

            migrationBuilder.DropIndex(
                name: "IX_evaluations_FormVersionId",
                table: "evaluations");

            migrationBuilder.DropColumn(
                name: "FormVersionId",
                table: "observation_categories");

            migrationBuilder.DropColumn(
                name: "FormVersionId",
                table: "evaluations");
        }
    }
}
