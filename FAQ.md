# Frequently Asked Questions (FAQ)

<details>
<summary><strong>What are the best models for PocketApp?</strong></summary>

For the best experience with PocketApp, we recommend using the following models:

- **Claude 3.7 Sonnet / Claude 3.5 Sonnet**: Best overall full-stack coders, providing excellent results across all frontend and PocketBase backend use cases
- **Gemini 2.0 Flash / Pro**: Exceptional speed and large context window for rapid development
- **GPT-4o**: Strong alternative with reliable TypeScript and React code generation
- **DeepSeek V3 / DeepSeekCoder**: Outstanding open-weights coding models
- **Qwen 2.5 Coder 32b**: Excellent option for local self-hosting with Ollama or LM Studio

**Note**: Models with less than 7b parameters typically lack the instruction-following capability required for multi-file full-stack generation.

</details>

<details>
<summary><strong>How do I get the best results with PocketApp?</strong></summary>

- **Be specific about your stack and collections**:  
  Mention your desired frontend components and what data collections (e.g. users, posts, comments, tasks) you need in PocketBase.
- **Use the enhance prompt icon**:  
  Before sending your prompt, click the _enhance_ icon to let the AI refine your prompt with architectural details.
- **Scaffold the basics first, then add features**:  
  Ensure the foundational structure and database models are working before asking for complex business logic.
- **Batch simple instructions**:  
  Combine simple tasks into a single prompt to save time and API tokens:  
  _"Change the color scheme to dark slate, add mobile responsiveness, and add status badges to items."_
</details>

<details>
<summary><strong>How does PocketBase integrate with generated apps?</strong></summary>

PocketApp includes built-in PocketBase support:
- A local PocketBase instance runs alongside the app (`http://127.0.0.1:8090`).
- Generated applications automatically initialize the PocketBase JavaScript SDK (`pocketbase`).
- Schema migrations and seed data can be exported alongside your frontend code in a single ZIP.
</details>

<details>
<summary><strong>How do I contribute to PocketApp?</strong></summary>

Check out our [Contribution Guide](CONTRIBUTING.md) for details on submitting pull requests and reporting issues.

</details>

<details>
<summary><strong>Common Errors and Troubleshooting</strong></summary>

### **"There was an error processing this request"**

Check both:
- The terminal running the dev server.
- The browser developer console (`F12` > _Console_ tab).

### **"API key missing"**

Click the **🔑 API Keys** button in the header or open Settings → Providers to enter your API key for your chosen provider.

### **Blank preview when running the app**

To troubleshoot:
- Check the developer console for runtime syntax errors.
- Check the Terminal tab in the workbench for build errors.
- Click the "Fix with AI" button on any error toast to auto-resolve issues.

### **"Received structured exception #0xc0000005: access violation" (Windows)**

Update your system to the latest [Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170).

</details>

---

Got more questions? Feel free to reach out or open an issue in the [GitHub repository](https://github.com/simo48hour/pocketapp/issues)!
