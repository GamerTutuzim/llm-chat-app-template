/**
 * LLM Chat Application Template
 *
 * Chat normal do site + API exclusiva para ESP32.
 *
 * @license MIT
 */

import { Env, ChatMessage } from "./types";

// ======================================================
// MODELO
// ======================================================

const MODEL_ID =
	"@cf/meta/llama-3.1-8b-instruct-fp8";

// ======================================================
// PROMPT DO SITE
// ======================================================

const SYSTEM_PROMPT =
	"You are a helpful, friendly assistant. Provide concise and accurate responses.";

// ======================================================
// WORKER
// ======================================================

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {

		const url = new URL(request.url);

		// --------------------------------------------------
		// SITE
		// --------------------------------------------------

		if (
			url.pathname === "/" ||
			!url.pathname.startsWith("/api/")
		) {
			return env.ASSETS.fetch(request);
		}

		// --------------------------------------------------
		// API DO ESP32
		// --------------------------------------------------

		if (url.pathname === "/api/esp32") {

			if (request.method !== "POST") {

				return new Response(
					"Method not allowed",
					{ status: 405 },
				);
			}

			return handleESP32Request(
				request,
				env,
			);
		}

		// --------------------------------------------------
		// API DO SITE
		// --------------------------------------------------

		if (url.pathname === "/api/chat") {

			if (request.method === "POST") {

				return handleChatRequest(
					request,
					env,
				);
			}

			return new Response(
				"Method not allowed",
				{ status: 405 },
			);
		}

		// --------------------------------------------------
		// 404
		// --------------------------------------------------

		return new Response(
			"Not found",
			{ status: 404 },
		);
	},
} satisfies ExportedHandler<Env>;

// ======================================================
// API ESP32
// ======================================================

async function handleESP32Request(
	request: Request,
	env: Env,
): Promise<Response> {

	try {

		// --------------------------------------------------
		// LER JSON
		// --------------------------------------------------

		const body =
			(await request.json()) as {
				mensagem?: string;
			};

		const mensagem =
			body.mensagem?.trim();

		// --------------------------------------------------
		// VALIDAR MENSAGEM
		// --------------------------------------------------

		if (!mensagem) {

			return new Response(
				JSON.stringify({
					error: "Mensagem vazia",
				}),
				{
					status: 400,
					headers: {
						"content-type":
							"application/json; charset=utf-8",
					},
				},
			);
		}

		// --------------------------------------------------
		// MENSAGENS
		// --------------------------------------------------

		const messages: ChatMessage[] = [

			{
				role: "system",
				content:
					"Você é uma IA dentro de um pequeno celular feito com ESP32. Responda em português, de forma curta, clara e amigável.",
			},

			{
				role: "user",
				content: mensagem,
			},
		];

		// --------------------------------------------------
		// ENTRADA DO MODELO
		// --------------------------------------------------

		const inputs = {

			messages,

			max_tokens: 256,

			stream: false,

		} satisfies
			AiTextGenerationInput & {
				stream: false;
			};

		// --------------------------------------------------
		// CHAMAR IA
		// --------------------------------------------------

		const resposta =
			await env.AI.run<
				typeof MODEL_ID
			>(
				MODEL_ID,
				inputs,
			);

		// --------------------------------------------------
		// RETORNAR RESPOSTA
		// --------------------------------------------------

		return new Response(
			JSON.stringify({
				resposta:
					resposta.response,
			}),
			{
				status: 200,

				headers: {
					"content-type":
						"application/json; charset=utf-8",
				},
			},
		);

	} catch (error) {

		console.error(
			"Erro na API do ESP32:",
			error,
		);

		return new Response(
			JSON.stringify({
				error:
					error instanceof Error
						? error.message
						: String(error),
			}),
			{
				status: 500,

				headers: {
					"content-type":
						"application/json; charset=utf-8",
				},
			},
		);
	}
}

// ======================================================
// API DO SITE
// ======================================================

async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {

	try {

		const {
			messages = [],
		} =
			(await request.json()) as {
				messages: ChatMessage[];
			};

		// ------------------------------------------------
		// SYSTEM PROMPT
		// ------------------------------------------------

		if (
			!messages.some(
				(msg) =>
					msg.role === "system",
			)
		) {

			messages.unshift({
				role: "system",
				content: SYSTEM_PROMPT,
			});
		}

		// ------------------------------------------------
		// ENTRADA
		// ------------------------------------------------

		const inputs = {

			messages,

			max_tokens: 1024,

			stream: true,

		} satisfies
			AiTextGenerationInput & {
				stream: true;
			};

		// ------------------------------------------------
		// STREAM
		// ------------------------------------------------

		const stream =
			await env.AI.run<
				typeof MODEL_ID
			>(
				MODEL_ID,
				inputs,
			);

		return new Response(
			stream,
			{
				headers: {
					"content-type":
						"text/event-stream; charset=utf-8",

					"cache-control":
						"no-cache",

					connection:
						"keep-alive",
				},
			},
		);

	} catch (error) {

		console.error(
			"Error processing chat request:",
			error,
		);

		return new Response(
			JSON.stringify({
				error:
					"Failed to process request",
			}),
			{
				status: 500,

				headers: {
					"content-type":
						"application/json",
				},
			},
		);
	}
}
