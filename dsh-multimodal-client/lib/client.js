window.__ModuleLoader__.load({
	id: "dsh-multimodal-client",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		//#region \0dsh-css:D:\program\deepseek-harness\packages\client\ui-multimodal\src\client\GenerateImageRow.module.css.mjs
		const css$1 = ".oa5J6G_row{flex-direction:column;gap:8px;padding:4px 0;display:flex}.oa5J6G_image{border:1px solid var(--dsw-alias-border-l2);object-fit:contain;border-radius:8px;align-self:flex-start;max-width:100%;max-height:460px;display:block}.oa5J6G_muted,.oa5J6G_loading{color:var(--dsw-alias-label-tertiary);white-space:pre-wrap;padding:4px 0;font-size:12px;line-height:18px}.oa5J6G_loading{background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:12px}";
		const tagId$1 = "dsh-multimodal-client/GenerateImageRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-multimodal-client";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var GenerateImageRow_module_css_default = {
			"row": "oa5J6G_row",
			"loading": "oa5J6G_loading",
			"image": "oa5J6G_image",
			"muted": "oa5J6G_muted"
		};
		//#endregion
		//#region lib/types/client/GenerateImageRow.js
		/** Inline image row for the generate_image / show_image tool-call cards. */
		/** Resolve session-authorized attachments and render them inline. */
		function GenerateImageRow({ block, sessionId, resolveImage }) {
			const isResult = block != null && block.kind === "tool-result";
			const meta = isResult ? block.meta : null;
			const raw = meta != null && typeof meta === "object" ? meta.images : null;
			const images = Array.isArray(raw) ? raw : [];
			const key = images.map((image) => image.attachmentId).join(",");
			const [urls, setUrls] = (0, react.useState)({});
			(0, react.useEffect)(() => {
				if (images.length === 0) return;
				let cancelled = false;
				for (const image of images) resolveImage(sessionId, image.attachmentId).then((url) => {
					if (cancelled) return;
					setUrls((previous) => ({
						...previous,
						[image.attachmentId]: url
					}));
				}).catch(() => {});
				return () => {
					cancelled = true;
				};
			}, [
				sessionId,
				key,
				resolveImage
			]);
			if (images.length === 0) {
				if (isResult) {
					const text = (block.content ?? []).filter((item) => item?.type === "text").map((item) => item.text ?? "").join("\n");
					return (0, react_jsx_runtime.jsx)("div", {
						className: GenerateImageRow_module_css_default.muted,
						children: text || "生成完成"
					});
				}
				return (0, react_jsx_runtime.jsx)("div", {
					className: GenerateImageRow_module_css_default.muted,
					children: "正在生成图片…"
				});
			}
			return (0, react_jsx_runtime.jsx)("div", {
				className: GenerateImageRow_module_css_default.row,
				children: images.map((image) => {
					const url = urls[image.attachmentId];
					return url ? (0, react_jsx_runtime.jsx)("img", {
						className: GenerateImageRow_module_css_default.image,
						src: url,
						alt: image.name ?? "generated"
					}, image.attachmentId) : (0, react_jsx_runtime.jsx)("div", {
						className: GenerateImageRow_module_css_default.loading,
						children: "加载图片…"
					}, image.attachmentId);
				})
			});
		}
		//#endregion
		//#region lib/types/client/TurnImages.js
		/** Turn-tail gallery: every image produced during the turn, rendered inline. */
		const TurnImages = (0, react.memo)(function TurnImages({ matched, sessionId, resolveImage }) {
			const key = matched.map((i) => i.attachment.attachmentId).join(",");
			const [urls, setUrls] = (0, react.useState)({});
			(0, react.useEffect)(() => {
				if (matched.length === 0) return;
				let cancelled = false;
				for (const image of matched) {
					const id = String(image.attachment.attachmentId);
					if (urls[id]) continue;
					resolveImage(sessionId, id).then((url) => {
						if (cancelled) return;
						setUrls((prev) => ({
							...prev,
							[id]: url
						}));
					}).catch(() => {});
				}
				return () => {
					cancelled = true;
				};
			}, [
				sessionId,
				key,
				resolveImage
			]);
			if (matched.length === 0) return null;
			return (0, react_jsx_runtime.jsx)("div", {
				className: GenerateImageRow_module_css_default.row,
				children: matched.map((image) => {
					const id = String(image.attachment.attachmentId);
					const url = urls[id];
					return url ? (0, react_jsx_runtime.jsx)("img", {
						className: GenerateImageRow_module_css_default.image,
						src: url,
						alt: image.attachment.name ?? "image"
					}, id) : (0, react_jsx_runtime.jsx)("div", {
						className: GenerateImageRow_module_css_default.loading,
						children: "加载图片…"
					}, id);
				})
			});
		});
		//#endregion
		//#region lib/types/client/turn-images.js
		/** Read one presentationMeta-shaped object's declared images and final flag. */
		function readMeta(meta) {
			if (meta === null || typeof meta !== "object") return {
				images: [],
				final: false
			};
			const m = meta;
			const images = [];
			if (Array.isArray(m.images)) {
				for (const image of m.images) if (image && typeof image === "object" && typeof image.attachmentId === "string") images.push(image);
			}
			return {
				images,
				final: m.final === true
			};
		}
		/** Turn-local final-image accumulator; publishes no view Node. */
		const turnImagesDefinition = {
			kind: "turnImages",
			match: (event) => {
				if (event.type === "turn/start") return {
					id: String(event.data.turn),
					role: "start"
				};
				if (event.type === "tool/result") return {
					id: String(event.data.turn),
					role: "update"
				};
				return null;
			},
			start: (_context, match) => {
				if (match.event.type !== "turn/start") throw new Error("turnImages start requires turn/start");
				return {
					turn: match.event.data.turn,
					images: []
				};
			},
			update: (context, match) => {
				if (match.event.type !== "tool/result") return context.state;
				const message = match.event.data.message;
				if (message === void 0) return context.state;
				const meta = message.meta;
				const { images, final } = readMeta(meta);
				if (!final || images.length === 0) return context.state;
				const seen = new Set(context.state.images.map((r) => String(r.attachment.attachmentId)));
				const additions = [];
				for (const ref of images) {
					const id = String(ref.attachmentId);
					if (seen.has(id)) continue;
					seen.add(id);
					additions.push({
						seq: match.event.seq,
						attachment: ref
					});
				}
				if (additions.length === 0) return context.state;
				return {
					...context.state,
					images: [...context.state.images, ...additions]
				};
			},
			buildLocationData: (context, scope) => scope !== "turn" || context.state === void 0 ? null : {
				kind: "turn",
				turn: context.state.turn,
				key: "turnImages",
				value: { images: context.state.images }
			}
		};
		/**
		* Claim the turn-tail chain only when the turn produced final images.
		* @param owner - Turn-tail owner currency for the closing assistant.
		* @returns Final image refs as the component's match, or null to decline.
		*/
		function selectTurnImages(owner) {
			const data = owner.turn.data.get("turnImages");
			if (data === void 0) return null;
			const filtered = data.images.filter((ref) => ref.seq <= owner.seq);
			return filtered.length === 0 ? null : filtered;
		}
		//#endregion
		//#region \0dsh-css:D:\program\deepseek-harness\packages\client\ui-multimodal\src\client\MultimodalSettingsSection.module.css.mjs
		const css = ".HI6d2W_section{width:100%;max-width:980px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:18px;display:flex}.HI6d2W_headingBlock{flex-direction:column;gap:6px;display:flex}.HI6d2W_heading{margin:0;font-size:18px;font-weight:600;line-height:26px}.HI6d2W_intro{max-width:760px;color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px;line-height:20px}.HI6d2W_grid{grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch;gap:14px;display:grid}.HI6d2W_card{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:8px;flex-direction:column;gap:14px;min-width:0;height:100%;padding:16px;display:flex}.HI6d2W_card[data-enabled=false]{border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2)}.HI6d2W_cardHeader{border-bottom:1px solid var(--dsw-alias-border-l2);justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:12px;display:flex}.HI6d2W_cardTitle{margin:0;font-size:15px;font-weight:600;line-height:22px}.HI6d2W_cardSubtitle{color:var(--dsw-alias-label-tertiary);margin:3px 0 0;font-size:12px;line-height:18px}.HI6d2W_switchLabel{cursor:pointer;flex:none;align-items:center;gap:7px;display:inline-flex}.HI6d2W_switchInput{clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}.HI6d2W_switchTrack{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1);border-radius:999px;align-items:center;width:34px;height:19px;padding:2px;transition:border-color .16s,background .16s;display:inline-flex}.HI6d2W_switchThumb{background:var(--dsw-alias-label-tertiary);border-radius:50%;width:13px;height:13px;transition:transform .16s,background .16s}.HI6d2W_switchInput:checked+.HI6d2W_switchTrack{border-color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-state-success-tertiary)}.HI6d2W_switchInput:checked+.HI6d2W_switchTrack .HI6d2W_switchThumb{background:var(--dsw-alias-state-success-primary);transform:translate(15px)}.HI6d2W_switchInput:focus-visible+.HI6d2W_switchTrack{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.HI6d2W_switchText{min-width:36px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.HI6d2W_fields,.HI6d2W_field{flex-direction:column;display:flex}.HI6d2W_fields{gap:12px}.HI6d2W_field{gap:6px}.HI6d2W_fieldLabel{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:18px}.HI6d2W_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;min-width:0;color:var(--dsw-alias-label-primary);font:inherit;font-family:var(--dsw-font-mono,ui-monospace, SFMono-Regular, Menlo, monospace);border-radius:7px;outline:none;padding:9px 10px;font-size:12px;line-height:18px}.HI6d2W_input:hover{border-color:var(--dsw-alias-border-l3)}.HI6d2W_input:focus{border-color:var(--dsw-alias-brand-primary)}.HI6d2W_input::placeholder{color:var(--dsw-alias-label-dimmed)}.HI6d2W_loading{color:var(--dsw-alias-label-tertiary);margin:0;font-size:11px;line-height:18px}.HI6d2W_clearButton{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:0;align-self:flex-start;padding:0;font-size:11px;line-height:18px}.HI6d2W_clearButton:hover:not(:disabled){color:var(--dsw-alias-state-error-primary)}.HI6d2W_actions{justify-content:flex-end;gap:8px;margin-top:auto;padding-top:2px;display:flex}.HI6d2W_primaryButton,.HI6d2W_secondaryButton{min-height:32px;font:inherit;cursor:pointer;border-radius:7px;padding:6px 12px;font-size:12px;line-height:18px}.HI6d2W_primaryButton{border:1px solid var(--dsw-alias-label-primary);background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.HI6d2W_secondaryButton{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.HI6d2W_primaryButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}.HI6d2W_secondaryButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.HI6d2W_primaryButton:focus-visible,.HI6d2W_secondaryButton:focus-visible,.HI6d2W_clearButton:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.HI6d2W_primaryButton:disabled,.HI6d2W_secondaryButton:disabled,.HI6d2W_clearButton:disabled{cursor:default;opacity:.45}.HI6d2W_message{overflow-wrap:anywhere;margin:0;padding-top:2px;font-size:12px;line-height:18px}.HI6d2W_message[data-state=success]{color:var(--dsw-alias-state-success-primary)}.HI6d2W_message[data-state=error]{color:var(--dsw-alias-state-error-primary)}@media (width<=820px){.HI6d2W_grid{grid-template-columns:1fr}}@media (prefers-reduced-motion:reduce){.HI6d2W_switchTrack,.HI6d2W_switchThumb{transition:none}}";
		const tagId = "dsh-multimodal-client/MultimodalSettingsSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-multimodal-client";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var MultimodalSettingsSection_module_css_default = {
			"section": "HI6d2W_section",
			"headingBlock": "HI6d2W_headingBlock",
			"cardHeader": "HI6d2W_cardHeader",
			"switchTrack": "HI6d2W_switchTrack",
			"intro": "HI6d2W_intro",
			"field": "HI6d2W_field",
			"fields": "HI6d2W_fields",
			"switchLabel": "HI6d2W_switchLabel",
			"loading": "HI6d2W_loading",
			"input": "HI6d2W_input",
			"switchText": "HI6d2W_switchText",
			"actions": "HI6d2W_actions",
			"secondaryButton": "HI6d2W_secondaryButton",
			"card": "HI6d2W_card",
			"cardSubtitle": "HI6d2W_cardSubtitle",
			"switchInput": "HI6d2W_switchInput",
			"message": "HI6d2W_message",
			"clearButton": "HI6d2W_clearButton",
			"heading": "HI6d2W_heading",
			"cardTitle": "HI6d2W_cardTitle",
			"grid": "HI6d2W_grid",
			"fieldLabel": "HI6d2W_fieldLabel",
			"primaryButton": "HI6d2W_primaryButton",
			"switchThumb": "HI6d2W_switchThumb"
		};
		//#endregion
		//#region lib/types/client/MultimodalSettingsSection.js
		/** Multimodal settings: independent visual and image-generation channels. */
		const EMPTY_DRAFT = {
			visionEnabled: true,
			visionModel: "",
			visionBaseUrl: "",
			generationEnabled: true,
			generationModel: "",
			generationBaseUrl: "",
			visionApiKey: "",
			generationApiKey: ""
		};
		const EMPTY_CREDENTIAL = {
			configured: false,
			writable: true
		};
		function channelLabel(channel) {
			return channel === "vision" ? "视觉模型" : "生图模型";
		}
		function getErrorMessage(value) {
			return value instanceof Error ? value.message : String(value);
		}
		async function requestJson(path, init) {
			const response = await fetch(path, init);
			const body = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
			return body;
		}
		/** Render two independent multimodal channel cards. */
		function MultimodalSettingsSection() {
			const [draft, setDraft] = (0, react.useState)(EMPTY_DRAFT);
			const [credentials, setCredentials] = (0, react.useState)({
				vision: EMPTY_CREDENTIAL,
				generation: EMPTY_CREDENTIAL
			});
			const [loading, setLoading] = (0, react.useState)(true);
			const [loadError, setLoadError] = (0, react.useState)("");
			const [operations, setOperations] = (0, react.useState)({
				vision: null,
				generation: null
			});
			const [messages, setMessages] = (0, react.useState)({
				vision: null,
				generation: null
			});
			(0, react.useEffect)(() => {
				let cancelled = false;
				requestJson("/global-multimodal/config").then((value) => {
					if (cancelled) return;
					const config = value;
					setDraft({
						visionEnabled: config.visionEnabled,
						visionModel: config.visionModel,
						visionBaseUrl: config.visionBaseUrl,
						generationEnabled: config.generationEnabled,
						generationModel: config.generationModel,
						generationBaseUrl: config.generationBaseUrl,
						visionApiKey: "",
						generationApiKey: ""
					});
					setCredentials({
						vision: config.credentials?.vision ?? EMPTY_CREDENTIAL,
						generation: config.credentials?.generation ?? EMPTY_CREDENTIAL
					});
					setLoading(false);
				}).catch((error) => {
					if (cancelled) return;
					setLoadError(`读取多模态配置失败：${getErrorMessage(error)}`);
					setLoading(false);
				});
				return () => {
					cancelled = true;
				};
			}, []);
			function update(channel, field, value) {
				setDraft((previous) => ({
					...previous,
					[field]: value
				}));
				setMessages((previous) => ({
					...previous,
					[channel]: null
				}));
			}
			function setOperation(channel, operation) {
				setOperations((previous) => ({
					...previous,
					[channel]: operation
				}));
			}
			function syncPublicConfig(value) {
				setCredentials({
					vision: value.credentials?.vision ?? EMPTY_CREDENTIAL,
					generation: value.credentials?.generation ?? EMPTY_CREDENTIAL
				});
				setDraft((previous) => ({
					...previous,
					visionEnabled: value.visionEnabled,
					visionModel: value.visionModel,
					visionBaseUrl: value.visionBaseUrl,
					generationEnabled: value.generationEnabled,
					generationModel: value.generationModel,
					generationBaseUrl: value.generationBaseUrl
				}));
			}
			async function save(channel) {
				setOperation(channel, "save");
				setMessages((previous) => ({
					...previous,
					[channel]: null
				}));
				try {
					const model = (channel === "vision" ? draft.visionModel : draft.generationModel).trim();
					const baseUrl = (channel === "vision" ? draft.visionBaseUrl : draft.generationBaseUrl).trim();
					if ((channel === "vision" ? draft.visionEnabled : draft.generationEnabled) && (model === "" || baseUrl === "")) throw new Error("已启用的通道需填写模型 ID 与 Base URL");
					const saved = await requestJson("/global-multimodal/config", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							visionEnabled: draft.visionEnabled,
							visionModel: draft.visionModel,
							visionBaseUrl: draft.visionBaseUrl,
							generationEnabled: draft.generationEnabled,
							generationModel: draft.generationModel,
							generationBaseUrl: draft.generationBaseUrl
						})
					});
					const key = channel === "vision" ? draft.visionApiKey.trim() : draft.generationApiKey.trim();
					if (key) await requestJson("/global-multimodal/credential", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							channel,
							apiKey: key
						})
					});
					syncPublicConfig(key ? await requestJson("/global-multimodal/config") : saved);
					setDraft((previous) => ({
						...previous,
						[channel === "vision" ? "visionApiKey" : "generationApiKey"]: ""
					}));
					setMessages((previous) => ({
						...previous,
						[channel]: {
							kind: "success",
							text: "已保存，下一次调用立即生效。"
						}
					}));
				} catch (error) {
					setMessages((previous) => ({
						...previous,
						[channel]: {
							kind: "error",
							text: `保存失败：${getErrorMessage(error)}`
						}
					}));
				} finally {
					setOperation(channel, null);
				}
			}
			async function test(channel) {
				setOperation(channel, "test");
				setMessages((previous) => ({
					...previous,
					[channel]: null
				}));
				try {
					const apiKey = channel === "vision" ? draft.visionApiKey.trim() : draft.generationApiKey.trim();
					const payload = channel === "vision" ? {
						channel,
						apiKey,
						model: draft.visionModel,
						baseUrl: draft.visionBaseUrl
					} : {
						channel,
						apiKey,
						model: draft.generationModel,
						baseUrl: draft.generationBaseUrl
					};
					const result = await requestJson("/global-multimodal/test", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(payload)
					});
					setMessages((previous) => ({
						...previous,
						[channel]: {
							kind: "success",
							text: result.message || "连接正常。"
						}
					}));
				} catch (error) {
					setMessages((previous) => ({
						...previous,
						[channel]: {
							kind: "error",
							text: `连接失败：${getErrorMessage(error)}`
						}
					}));
				} finally {
					setOperation(channel, null);
				}
			}
			async function clearCredential(channel) {
				setOperation(channel, "clear");
				setMessages((previous) => ({
					...previous,
					[channel]: null
				}));
				try {
					await requestJson("/global-multimodal/credential", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							channel,
							clear: true
						})
					});
					setCredentials((previous) => ({
						...previous,
						[channel]: EMPTY_CREDENTIAL
					}));
					setMessages((previous) => ({
						...previous,
						[channel]: {
							kind: "success",
							text: "已清除该通道的 API Key。"
						}
					}));
				} catch (error) {
					setMessages((previous) => ({
						...previous,
						[channel]: {
							kind: "error",
							text: `清除失败：${getErrorMessage(error)}`
						}
					}));
				} finally {
					setOperation(channel, null);
				}
			}
			function renderChannel(channel) {
				const vision = channel === "vision";
				const enabled = vision ? draft.visionEnabled : draft.generationEnabled;
				const model = vision ? draft.visionModel : draft.generationModel;
				const baseUrl = vision ? draft.visionBaseUrl : draft.generationBaseUrl;
				const key = vision ? draft.visionApiKey : draft.generationApiKey;
				const operation = operations[channel];
				const message = messages[channel];
				const info = credentials[channel];
				return (0, react_jsx_runtime.jsxs)("article", {
					className: MultimodalSettingsSection_module_css_default.card,
					"data-enabled": enabled ? "true" : "false",
					children: [
						(0, react_jsx_runtime.jsxs)("header", {
							className: MultimodalSettingsSection_module_css_default.cardHeader,
							children: [(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("h3", {
								className: MultimodalSettingsSection_module_css_default.cardTitle,
								children: channelLabel(channel)
							}), (0, react_jsx_runtime.jsx)("p", {
								className: MultimodalSettingsSection_module_css_default.cardSubtitle,
								children: vision ? "图片识别、OCR、图表与界面分析" : "文生图、参考图编辑与图片生成"
							})] }), (0, react_jsx_runtime.jsxs)("label", {
								className: MultimodalSettingsSection_module_css_default.switchLabel,
								children: [
									(0, react_jsx_runtime.jsx)("input", {
										className: MultimodalSettingsSection_module_css_default.switchInput,
										type: "checkbox",
										checked: enabled,
										onChange: (event) => {
											update(channel, vision ? "visionEnabled" : "generationEnabled", event.target.checked);
										},
										"aria-label": `${channelLabel(channel)}${enabled ? "已启用" : "已停用"}`
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: MultimodalSettingsSection_module_css_default.switchTrack,
										"aria-hidden": "true",
										children: (0, react_jsx_runtime.jsx)("span", { className: MultimodalSettingsSection_module_css_default.switchThumb })
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: MultimodalSettingsSection_module_css_default.switchText,
										children: enabled ? "已启用" : "已停用"
									})
								]
							})]
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: MultimodalSettingsSection_module_css_default.fields,
							children: [
								(0, react_jsx_runtime.jsxs)("label", {
									className: MultimodalSettingsSection_module_css_default.field,
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: MultimodalSettingsSection_module_css_default.fieldLabel,
										children: "模型 ID"
									}), (0, react_jsx_runtime.jsx)("input", {
										className: MultimodalSettingsSection_module_css_default.input,
										value: model,
										spellCheck: false,
										placeholder: "填写模型 ID",
										onChange: (event) => {
											update(channel, vision ? "visionModel" : "generationModel", event.target.value);
										}
									})]
								}),
								(0, react_jsx_runtime.jsxs)("label", {
									className: MultimodalSettingsSection_module_css_default.field,
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: MultimodalSettingsSection_module_css_default.fieldLabel,
										children: "Base URL"
									}), (0, react_jsx_runtime.jsx)("input", {
										className: MultimodalSettingsSection_module_css_default.input,
										value: baseUrl,
										spellCheck: false,
										placeholder: "填写 Base URL（OpenAI 兼容端点，如 https://api.example.com/v3）",
										onChange: (event) => {
											update(channel, vision ? "visionBaseUrl" : "generationBaseUrl", event.target.value);
										}
									})]
								}),
								(0, react_jsx_runtime.jsxs)("label", {
									className: MultimodalSettingsSection_module_css_default.field,
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: MultimodalSettingsSection_module_css_default.fieldLabel,
										children: "API Key"
									}), (0, react_jsx_runtime.jsx)("input", {
										className: MultimodalSettingsSection_module_css_default.input,
										type: "password",
										value: key,
										autoComplete: "new-password",
										placeholder: info.configured ? "已配置，留空保持不变" : "填写后保存到本机凭据",
										onChange: (event) => {
											update(channel, vision ? "visionApiKey" : "generationApiKey", event.target.value);
										}
									})]
								})
							]
						}),
						info.configured && info.writable ? (0, react_jsx_runtime.jsx)("button", {
							className: MultimodalSettingsSection_module_css_default.clearButton,
							type: "button",
							disabled: operation !== null,
							onClick: () => {
								clearCredential(channel);
							},
							children: "清除已保存 API Key"
						}) : null,
						(0, react_jsx_runtime.jsxs)("footer", {
							className: MultimodalSettingsSection_module_css_default.actions,
							children: [(0, react_jsx_runtime.jsx)("button", {
								className: MultimodalSettingsSection_module_css_default.secondaryButton,
								type: "button",
								disabled: operation !== null || loading || model.trim() === "" || baseUrl.trim() === "",
								title: model.trim() === "" || baseUrl.trim() === "" ? "请先填写模型 ID 与 Base URL" : void 0,
								onClick: () => {
									test(channel);
								},
								children: operation === "test" ? "测试中…" : "测试连接"
							}), (0, react_jsx_runtime.jsx)("button", {
								className: MultimodalSettingsSection_module_css_default.primaryButton,
								type: "button",
								disabled: operation !== null || loading,
								onClick: () => {
									save(channel);
								},
								children: operation === "save" ? "保存中…" : "保存配置"
							})]
						}),
						message ? (0, react_jsx_runtime.jsx)("p", {
							className: MultimodalSettingsSection_module_css_default.message,
							"data-state": message.kind,
							role: message.kind === "error" ? "alert" : "status",
							children: message.text
						}) : null
					]
				});
			}
			if (loading) return (0, react_jsx_runtime.jsx)("div", {
				className: MultimodalSettingsSection_module_css_default.section,
				children: (0, react_jsx_runtime.jsx)("p", {
					className: MultimodalSettingsSection_module_css_default.loading,
					children: "正在读取多模态配置…"
				})
			});
			if (loadError) return (0, react_jsx_runtime.jsx)("div", {
				className: MultimodalSettingsSection_module_css_default.section,
				children: (0, react_jsx_runtime.jsx)("p", {
					className: MultimodalSettingsSection_module_css_default.message,
					"data-state": "error",
					role: "alert",
					children: loadError
				})
			});
			return (0, react_jsx_runtime.jsxs)("section", {
				className: MultimodalSettingsSection_module_css_default.section,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: MultimodalSettingsSection_module_css_default.headingBlock,
					children: [(0, react_jsx_runtime.jsx)("h2", {
						className: MultimodalSettingsSection_module_css_default.heading,
						children: "多模态"
					}), (0, react_jsx_runtime.jsx)("p", {
						className: MultimodalSettingsSection_module_css_default.intro,
						children: "视觉与生图工具可在所有会话模式中使用。两种模型分别配置 API Key，密钥仅保存在 Harness 本机凭据中。"
					})]
				}), (0, react_jsx_runtime.jsxs)("div", {
					className: MultimodalSettingsSection_module_css_default.grid,
					children: [renderChannel("vision"), renderChannel("generation")]
				})]
			});
		}
		//#endregion
		//#region lib/types/client/index.js
		/** Required services: the slot registry, the sessions face, and conversation turn events. */
		const inject = [
			"slots",
			"sessions",
			"conversationEvents"
		];
		/** Mount the inline-image tool views, the turn-tail gallery, and the settings section. */
		function apply(ctx) {
			const face = () => ({ resolveImage(sessionId, attachmentId) {
				const binding = ctx.sessions.binding(sessionId);
				const session = binding === void 0 ? void 0 : binding.session;
				if (session === void 0) return Promise.reject(/* @__PURE__ */ new Error(`unknown session "${sessionId}"`));
				return session.readAttachment(attachmentId).then((result) => {
					if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
					const { attachment, data } = result.value;
					return `data:${attachment.mediaType};base64,${bytesToBase64(data)}`;
				});
			} });
			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: "generate_image",
				inject: face
			}, GenerateImageRow));
			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: "show_image",
				inject: face
			}, GenerateImageRow));
			ctx.conversationEvents.register(turnImagesDefinition);
			ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register({
				name: "conversation.chat.turnTail",
				select: selectTurnImages,
				inject: face
			}, TurnImages));
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "multimodal",
				order: 15,
				label: () => "多模态"
			}, MultimodalSettingsSection));
		}
		/** Encode a byte array as base64 (browser-safe, no Buffer). */
		function bytesToBase64(bytes) {
			let binary = "";
			const chunk = 32768;
			for (let i = 0; i < bytes.length; i += chunk) {
				const sub = Array.from(bytes.subarray(i, Math.min(i + chunk, bytes.length)));
				binary += String.fromCharCode.apply(null, sub);
			}
			return btoa(binary);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map