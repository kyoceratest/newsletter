using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

// Allow cross-origin (mirror PHP headers: Access-Control-Allow-Origin: *)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

var app = builder.Build();

app.UseCors("AllowAll");

// Serve static files directly from repo root (.. of aspnet folder)
var staticRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", ".."));
if (!Directory.Exists(staticRoot))
{
    // Fallback to parent of current working directory
    staticRoot = Path.GetFullPath(Path.Combine(Environment.CurrentDirectory, ".."));
}

var fileProvider = new PhysicalFileProvider(staticRoot);

// Default files (index.html, default.htm, etc.)
var defaultFiles = new DefaultFilesOptions { FileProvider = fileProvider };
app.UseDefaultFiles(defaultFiles);

// Static files from the repository root
app.UseStaticFiles(new StaticFileOptions { FileProvider = fileProvider });

// Mirror PHP save endpoint: POST /save_file.php with JSON { fileName, content }
app.MapPost("/save_file.php", async (HttpContext ctx) =>
{
    try
    {
        var payload = await ctx.Request.ReadFromJsonAsync<SaveRequest>();
        if (payload is null || string.IsNullOrWhiteSpace(payload.FileName) || string.IsNullOrWhiteSpace(payload.Content))
        {
            return Results.Json(new { error = "Missing fileName or content" }, statusCode: 400);
        }

        // Sanitize filename like PHP: only letters, numbers, underscore, dash
        var safeName = Regex.Replace(payload.FileName, "[^a-zA-Z0-9_\-]", "");
        if (string.IsNullOrWhiteSpace(safeName))
        {
            safeName = $"newsletter_{DateTime.Now:yyyy-MM-dd_H-mm-ss}";
        }
        if (!safeName.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
        {
            safeName += ".html";
        }

        var targetDir = @"C:\\Newsletter\\";
        Directory.CreateDirectory(targetDir);
        var filePath = Path.Combine(targetDir, safeName);

        await File.WriteAllTextAsync(filePath, payload.Content, Encoding.UTF8);

        return Results.Json(new
        {
            success = true,
            message = "File saved successfully",
            fileName = safeName,
            filePath
        });
    }
    catch (Exception ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: 500);
    }
});

app.Run();

record SaveRequest(string FileName, string Content);