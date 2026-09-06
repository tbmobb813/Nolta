import {
  CONTENT_TOOL_SCHEMAS,
  READ_ONLY_CONTENT_TOOLS,
  CONTENT_SKILL_TOOLS,
} from '../tool-schemas';

describe('CONTENT_SKILL_TOOLS', () => {
  it('is disjoint from READ_ONLY_CONTENT_TOOLS — skill-tools are never valid useTool()/MCP calls', () => {
    for (const name of CONTENT_SKILL_TOOLS) {
      expect(READ_ONLY_CONTENT_TOOLS.has(name)).toBe(false);
    }
  });

  it('every skill-tool name has a matching schema entry', () => {
    for (const name of CONTENT_SKILL_TOOLS) {
      expect(CONTENT_TOOL_SCHEMAS).toHaveProperty(name);
    }
  });

  it('mirrors every registered content skill except freeform', () => {
    expect([...CONTENT_SKILL_TOOLS].sort()).toEqual(
      [
        'generate_post_skill',
        'generate_plan_skill',
        'generate_plan_from_timeline_skill',
        'schedule_post_skill',
        'analyze_post_skill',
        'list_scheduled_skill',
        'propose_skill_skill',
      ].sort()
    );
  });
});

describe('account field exposure', () => {
  // Real live bug, 2026-09-06: every one of these skills/tools already
  // supports `account` at the implementation level (see generate-post.ts,
  // generate-plan.ts, schedule-post.ts, trendpost-mcp's content_generate/
  // content_generate_plan handlers) — but the model can only ever pass a
  // parameter that's actually in the schema it's shown. None of these had
  // `account` in CONTENT_TOOL_SCHEMAS, so any freeform (non-campaign-
  // dispatch) generate/schedule request had no way to target a specific
  // account, silently defeating the phase 1/1.5 account-tracking work for
  // this whole class of request.
  const toolsThatSupportAccount = [
    'content_generate',
    'content_generate_plan',
    'content_schedule_post',
    'generate_post_skill',
    'generate_plan_skill',
    'schedule_post_skill',
  ];

  it.each(toolsThatSupportAccount)('%s exposes an account property in its schema', (name) => {
    const properties = CONTENT_TOOL_SCHEMAS[name].inputSchema.properties as Record<string, unknown>;
    expect(properties).toHaveProperty('account');
  });
});
