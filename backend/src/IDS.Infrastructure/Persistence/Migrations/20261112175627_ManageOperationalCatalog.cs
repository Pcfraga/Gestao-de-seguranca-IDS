using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IDS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ManageOperationalCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DefaultAreaName",
                table: "tenants",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "Saúde e Segurança do Trabalho");

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "sites",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "organizations",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "inspection_areas",
                type: "boolean",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DefaultAreaName",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "sites");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "organizations");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "inspection_areas");
        }
    }
}
