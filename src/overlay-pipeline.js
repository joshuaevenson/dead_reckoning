export const OVERLAY_PIPELINE_STAGES = Object.freeze([
  "derive",
  "compose",
  "enrich",
  "validate",
]);

function currentAiMode(context) {
  return context?.runtimeCapabilities?.ai?.mode ?? context?.aiMode ?? "off";
}

function buildMetadata(featureId, context, stageState) {
  return {
    featureId,
    aiMode: currentAiMode(context),
    stages: [...OVERLAY_PIPELINE_STAGES],
    stageState,
  };
}

export function defineOverlayPipeline({
  featureId,
  derive,
  compose,
  enrich,
  validate,
}) {
  function deriveFacts(input, context) {
    return derive(input, context);
  }

  function composeBaseline(derived, input, context) {
    return compose(derived, input, context);
  }

  function runSymbolic(input, context = {}) {
    const derived = deriveFacts(input, context);
    const composed = composeBaseline(derived, input, context);
    return {
      output: composed,
      meta: buildMetadata(featureId, context, {
        derive: "completed",
        compose: "completed",
        enrich: "skipped",
        validate: "skipped",
      }),
    };
  }

  async function run(input, context = {}) {
    const symbolic = runSymbolic(input, context);
    const pipelineEnrich = context.enrich ?? enrich;
    const pipelineValidate = context.validate ?? validate;

    if (currentAiMode(context) === "off" || typeof pipelineEnrich !== "function") {
      return symbolic;
    }

    const { output: composed } = symbolic;
    const derived = deriveFacts(input, context);

    let enriched;
    try {
      enriched = await pipelineEnrich({
        featureId,
        input,
        derived,
        composed,
        runtimeCapabilities: context.runtimeCapabilities ?? null,
      });
    } catch {
      return {
        output: composed,
        meta: buildMetadata(featureId, context, {
          derive: "completed",
          compose: "completed",
          enrich: "failed",
          validate: "skipped",
        }),
      };
    }

    if (enriched == null) {
      return {
        output: composed,
        meta: buildMetadata(featureId, context, {
          derive: "completed",
          compose: "completed",
          enrich: "declined",
          validate: "skipped",
        }),
      };
    }

    if (typeof pipelineValidate !== "function") {
      return {
        output: enriched,
        meta: buildMetadata(featureId, context, {
          derive: "completed",
          compose: "completed",
          enrich: "completed",
          validate: "skipped",
        }),
      };
    }

    const isValid = await pipelineValidate({
      featureId,
      input,
      derived,
      composed,
      enriched,
      runtimeCapabilities: context.runtimeCapabilities ?? null,
    });

    if (!isValid) {
      return {
        output: composed,
        meta: buildMetadata(featureId, context, {
          derive: "completed",
          compose: "completed",
          enrich: "completed",
          validate: "failed",
        }),
      };
    }

    return {
      output: enriched,
      meta: buildMetadata(featureId, context, {
        derive: "completed",
        compose: "completed",
        enrich: "completed",
        validate: "completed",
      }),
    };
  }

  return {
    featureId,
    stages: [...OVERLAY_PIPELINE_STAGES],
    derive: deriveFacts,
    compose: composeBaseline,
    enrich,
    validate,
    runSymbolic,
    run,
  };
}
