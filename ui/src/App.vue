<script setup>
import { nextTick, onMounted, ref, watch } from "vue";
import Tag from "primevue/tag";
import Button from "primevue/button";
import Select from "primevue/select";
import InputNumber from "primevue/inputnumber";
import Message from "primevue/message";
import Textarea from "primevue/textarea";
import { useCommandState } from "./useCommandState";

const store = useCommandState();
const {
  ORDER_ACTIONS,
  WORKSPACE_VIEWS,
  PRODUCTION_FOCUS_OPTIONS,
  PRODUCTION_POSTURE_OPTIONS,
  api,
  world,
  ui,
  currentSeat,
  currentSeatHomeSystem,
  selectedSystem,
  selectedSystemFriendly,
  selectedSystemOverview,
  summaryCards,
  productionPlannerRows,
  mapLayout,
  mapCanvas,
  fleetMarkers,
  probeMarkers,
  starlaneSegments,
  feedItems,
  reconSummary,
  orderBrief,
  orderSubmission,
  destinationOptions,
  anchorOptions,
  probeOriginOptions,
  snapshotSystem,
  inboundFleets,
  totalShipsAtSystem,
  blockadeStatus,
  homeBadgeForSystem,
  systemTone,
  starClass,
  translateSystemId,
  loadInitialData,
  selectSystem,
  setSelectedSystemId,
  setActiveAction,
  setActiveWorkspace,
  prepareProbeForSystem,
  setProbeOriginSystemId,
  setProductionFocus,
  setProductionQuantity,
  setProductionPosture,
  setSpeculationText,
  submitActiveOrder,
} = store;

const mapViewport = ref(null);
const systemNodes = new Map();

function setSystemNode(systemId, element) {
  if (element) {
    systemNodes.set(systemId, element);
  } else {
    systemNodes.delete(systemId);
  }
}

function centerMapOnSystem(systemId) {
  const node = systemNodes.get(systemId);
  if (node?.scrollIntoView) {
    node.scrollIntoView({ block: "center", inline: "center" });
  }

  const viewport = mapViewport.value;
  const point = mapLayout.value.get(systemId);
  if (!viewport || !point) {
    return;
  }

  const left = Math.max(
    0,
    Math.min(point.x - viewport.clientWidth / 2, viewport.scrollWidth - viewport.clientWidth),
  );
  const top = Math.max(
    0,
    Math.min(point.y - viewport.clientHeight / 2, viewport.scrollHeight - viewport.clientHeight),
  );

  window.requestAnimationFrame(() => {
    viewport.scrollLeft = left;
    viewport.scrollTop = top;
  });
}

watch(
  () => ui.selectedSystemId,
  async (systemId) => {
    if (!systemId) {
      return;
    }

    await nextTick();
    window.requestAnimationFrame(() => {
      centerMapOnSystem(systemId);
    });
  },
  { flush: "post" },
);

onMounted(async () => {
  await loadInitialData();
});
</script>

<template>
  <div class="app-shell">
    <header class="command-header">
      <div class="header-brand">
        <span class="header-eyebrow">Dead Reckoning</span>
        <span class="header-title">Command Table</span>
      </div>

      <div v-if="summaryCards.length" class="header-analytics">
        <div v-for="card in summaryCards" :key="card.label" class="analytics-pill">
          <span class="analytics-label">{{ card.label }}</span>
          <span class="analytics-value">{{ card.value }}</span>
        </div>
      </div>

      <div class="header-meta">
        <Tag v-if="currentSeat" severity="contrast" rounded>{{ currentSeat.faction.name }}</Tag>
        <Tag v-if="currentSeatHomeSystem" severity="secondary" rounded>Home: {{ currentSeatHomeSystem.name }}</Tag>
        <Tag v-if="world.result" severity="info" rounded>{{ world.result.endDate }}</Tag>
        <Tag :severity="api.tone" rounded>{{ api.status }}</Tag>
      </div>
    </header>

    <Message v-if="api.error" severity="error" class="loading-message">
      {{ api.error }}
    </Message>

    <div class="workspace-shell">
      <aside class="workspace-rail">
        <div class="workspace-rail-top">
          <Button
            v-for="workspace in WORKSPACE_VIEWS"
            :key="workspace.key"
            class="workspace-button"
            :class="{ active: ui.activeWorkspace === workspace.key }"
            :icon="workspace.icon"
            text
            rounded
            :aria-label="workspace.label"
            :title="workspace.label"
            @click="setActiveWorkspace(workspace.key)"
          />
        </div>

        <div class="workspace-rail-bottom">
          <Tag v-if="currentSeat" severity="contrast" rounded>{{ currentSeat.faction.name }}</Tag>
        </div>
      </aside>

      <main class="workspace-stage">
        <section v-if="ui.activeWorkspace === 'map'" class="workspace-page workspace-map-page">
          <section class="map-panel workspace-map-panel">
            <div class="map-topline">
              <div>
                <div class="panel-kicker">Operational Picture</div>
                <div class="panel-title">Galaxy Map</div>
              </div>

              <div v-if="selectedSystemOverview" class="system-inspector">
                <div class="system-summary">
                  <div class="system-name">{{ selectedSystemOverview.title }}</div>
                  <div v-if="selectedSystemOverview.homeLabel" class="system-subline system-home-line">{{ selectedSystemOverview.homeLabel }}</div>
                  <div class="system-subline">{{ selectedSystemOverview.owner }}</div>
                  <div class="system-subline">
                    {{ selectedSystemOverview.starText }} · {{ selectedSystemOverview.metalText }}
                  </div>
                  <div class="system-subline">
                    {{ selectedSystemOverview.laneText }}<span v-if="selectedSystemOverview.blockadeText"> · {{ selectedSystemOverview.blockadeText }}</span>
                  </div>
                </div>

                <div class="system-facts">
                  <div
                    v-for="fact in selectedSystemOverview.facts"
                    :key="`${selectedSystemOverview.title}-${fact.label}`"
                    class="system-fact"
                  >
                    <span class="system-fact-label">{{ fact.label }}</span>
                    <span class="system-fact-value">{{ fact.value }}</span>
                  </div>
                </div>

                <div
                  v-if="selectedSystemOverview.probeStatus && !selectedSystemOverview.canSeeLocalIntel"
                  class="system-probe-callout"
                >
                  <div class="system-probe-copy">
                    <strong>{{ selectedSystemOverview.probeStatus.label }}</strong>
                    {{ selectedSystemOverview.probeStatus.detail }}
                  </div>
                  <Button
                    v-if="selectedSystemOverview.probeStatus.actionable"
                    label="Draft Probe Order"
                    icon="pi pi-search"
                    severity="contrast"
                    @click="prepareProbeForSystem(selectedSystem.system.id)"
                  />
                </div>
              </div>

              <div v-else class="map-empty-state">
                Select a star to inspect control, production, and available orders.
              </div>
            </div>

            <div class="map-stage">
              <div ref="mapViewport" class="map-viewport">
                <svg
                  :viewBox="`0 0 ${mapCanvas.width} ${mapCanvas.height}`"
                  class="galaxy-map"
                  :style="{ width: `${mapCanvas.width}px`, height: `${mapCanvas.height}px` }"
                  @click="setSelectedSystemId(null)"
                >
                  <g class="starlane-layer">
                    <g v-for="lane in starlaneSegments" :key="lane.laneId">
                      <line
                        :class="['starlane-line', `blockade-${lane.blockadeTone}`]"
                        :x1="lane.x1"
                        :y1="lane.y1"
                        :x2="lane.x2"
                        :y2="lane.y2"
                      />
                      <g v-if="lane.blockadeTone !== 'none'" :transform="`translate(${lane.midpointX} ${lane.midpointY})`">
                        <circle class="starlane-blockade-glow" r="8" />
                        <circle :class="['starlane-blockade-core', `blockade-${lane.blockadeTone}`]" r="4.5" />
                      </g>
                    </g>
                  </g>

                  <g class="fleet-layer">
                    <g
                      v-for="marker in fleetMarkers"
                      :key="marker.fleetId"
                      class="fleet-marker"
                      :transform="`translate(${marker.x} ${marker.y}) rotate(${marker.angle})`"
                    >
                      <title>{{ marker.detail }}</title>
                      <path :class="['fleet-arrow', `fleet-${marker.tone}`]" d="M -10 -6 L 10 0 L -10 6 L -4 0 Z" />
                      <text x="0" y="-10" text-anchor="middle" class="fleet-count">{{ marker.label }}</text>
                    </g>
                  </g>

                  <g class="probe-layer">
                    <g
                      v-for="marker in probeMarkers"
                      :key="marker.probeId"
                      class="probe-marker"
                      :transform="`translate(${marker.x} ${marker.y}) rotate(${marker.angle})`"
                    >
                      <title>{{ marker.detail }}</title>
                      <circle v-if="marker.status === 'on_station'" class="probe-node" r="7" />
                      <path v-else class="probe-arrow" d="M 0 -7 L 7 0 L 0 7 L -7 0 Z" />
                      <text x="0" y="3" text-anchor="middle" class="probe-text">{{ marker.label }}</text>
                    </g>
                  </g>

                  <g
                    v-for="system in world.scenario?.systems ?? []"
                    :key="system.id"
                    :ref="(element) => setSystemNode(system.id, element)"
                    class="system-group"
                    :transform="`translate(${mapLayout.get(system.id)?.x ?? 0} ${mapLayout.get(system.id)?.y ?? 0})`"
                    @click.stop="selectSystem(system.id)"
                  >
                    <circle
                      v-if="snapshotSystem(system.id)?.captureProgress > 0 || snapshotSystem(system.id)?.claimProgress > 0"
                      r="25"
                      class="system-halo"
                    />
                    <circle
                      :class="['system-ring', `tone-${systemTone(system.id)}`, { selected: ui.selectedSystemId === system.id }]"
                      r="16"
                    />
                    <circle :class="['system-core', starClass(system.starType)]" :r="system.starType === 'giant_or_exotic' ? 10 : 8" />
                    <g v-if="homeBadgeForSystem(system.id)" transform="translate(0 -28)">
                      <rect
                        :class="['system-home-badge', `badge-${homeBadgeForSystem(system.id).tone}`]"
                        x="-18"
                        y="-8"
                        width="36"
                        height="16"
                        rx="8"
                      />
                      <text x="0" y="4" text-anchor="middle" class="system-home-text">{{ homeBadgeForSystem(system.id).label }}</text>
                    </g>
                    <g v-if="blockadeStatus(system.id).status !== 'none'" transform="translate(-19 -22)">
                      <rect :class="['system-blockade-badge', `blockade-${blockadeStatus(system.id).status}`]" x="-10" y="-7" width="20" height="14" rx="7" />
                      <text x="0" y="4" text-anchor="middle" class="system-blockade-text">B</text>
                    </g>
                    <text x="0" y="34" text-anchor="middle" class="system-label">{{ system.name }}</text>
                    <g v-if="inboundFleets(system.id).length > 0">
                      <circle cx="16" cy="-16" r="10" class="incoming-marker" />
                      <text x="16" y="-12" text-anchor="middle" class="incoming-text">{{ inboundFleets(system.id).length }}</text>
                    </g>
                  </g>
                </svg>
              </div>
            </div>
          </section>

          <section class="orders-panel workspace-orders-panel">
            <div class="orders-bar">
              <div class="orders-actions">
                <Button
                  v-for="action in ORDER_ACTIONS"
                  :key="action.key"
                  :label="action.label"
                  :icon="action.icon"
                  :severity="ui.activeAction === action.key ? 'contrast' : 'secondary'"
                  :outlined="ui.activeAction !== action.key"
                  @click="setActiveAction(action.key)"
                />
              </div>

              <div class="orders-status">
                <div>
                  <div class="panel-kicker">Orders Dock</div>
                  <div class="panel-title">Immediate Action</div>
                </div>
                <Tag :severity="selectedSystemFriendly ? 'success' : 'secondary'" rounded>
                  {{ selectedSystemFriendly ? "Ready to order" : "Select a friendly system" }}
                </Tag>
              </div>
            </div>

            <div class="orders-drawer">
              <Message v-if="!selectedSystem" severity="secondary">
                Select a star on the map to see draftable orders.
              </Message>
              <Message v-else-if="!selectedSystemFriendly" severity="warn">
                This system can be inspected, but not commanded from.
              </Message>
              <template v-else>
                <div class="orders-layout">
                  <div class="form-grid">
                    <div v-if="ui.activeAction !== 'deploy_probe'" class="field">
                      <label>Origin</label>
                      <div class="static-field">{{ selectedSystem.system.name }}</div>
                    </div>

                    <div v-else class="field">
                      <label>Origin</label>
                      <Select
                        :model-value="ui.orderDraft.probeOriginId"
                        :options="probeOriginOptions"
                        option-label="label"
                        option-value="value"
                        fluid
                        @update:model-value="setProbeOriginSystemId"
                      />
                    </div>

                    <div v-if="ui.activeAction !== 'deploy_probe'" class="field">
                      <label>Destination</label>
                      <Select v-model="ui.orderDraft.destinationId" :options="destinationOptions" option-label="label" option-value="value" fluid />
                    </div>

                    <div v-if="['attack', 'reinforce', 'blockade', 'resupply'].includes(ui.activeAction)" class="field">
                      <label>Ships</label>
                      <InputNumber
                        v-model="ui.orderDraft.ships"
                        :min="1"
                        :max="Math.max(1, totalShipsAtSystem(selectedSystem.system.id, currentSeat.faction.id))"
                        show-buttons
                        fluid
                      />
                    </div>

                    <div v-if="ui.activeAction === 'resupply'" class="field">
                      <label>Cargo</label>
                      <Select v-model="ui.orderDraft.resupplyFocus" :options="['salt', 'metals']" fluid />
                    </div>

                    <div v-if="ui.activeAction === 'deploy_probe'" class="field">
                      <label>Anchor</label>
                      <Select v-model="ui.orderDraft.anchorId" :options="anchorOptions" option-label="label" option-value="value" fluid />
                    </div>

                    <div v-if="ui.activeAction === 'deploy_probe'" class="field">
                      <label>Probe ETA</label>
                      <div class="static-field">
                        {{ orderBrief.lines.find((line) => line.startsWith('Estimated arrival:'))?.replace('Estimated arrival: ', '') ?? 'Unknown' }}
                      </div>
                    </div>

                    <div v-if="ui.activeAction === 'trade'" class="field">
                      <label>Focus</label>
                      <Select v-model="ui.orderDraft.tradeFocus" :options="['salt', 'metals']" fluid />
                    </div>
                  </div>

                  <div class="orders-brief">
                    <div class="brief-title">{{ orderBrief.title }}</div>
                    <ul class="brief-list">
                      <li v-for="line in orderBrief.lines" :key="line">{{ line }}</li>
                    </ul>
                    <div class="brief-actions">
                      <Button
                        :label="orderSubmission.label"
                        :disabled="orderSubmission.disabled"
                        :loading="api.submitting"
                        severity="contrast"
                        @click="submitActiveOrder"
                      />
                    </div>
                    <p class="brief-footnote">
                      {{ orderSubmission.reason }}
                    </p>
                  </div>
                </div>
              </template>
            </div>
          </section>
        </section>

        <section v-else-if="ui.activeWorkspace === 'reports'" class="workspace-page workspace-reports-page">
          <section class="feed-panel reports-main-panel">
            <div class="feed-header">
              <div>
                <div class="panel-kicker">Signal Feed</div>
                <div class="panel-title">Latest Reports</div>
              </div>
              <Tag severity="info" rounded>{{ feedItems.length }} entries</Tag>
            </div>

            <div class="feed-scroll reports-scroll">
              <article
                v-for="(item, index) in feedItems"
                :key="`${item.date}-${index}`"
                :class="['feed-card', `feed-tone-${item.tone}`]"
              >
                <div class="feed-card-top">
                  <div class="feed-kicker">{{ item.kicker }}</div>
                  <Tag :severity="item.tone" rounded>{{ item.date }}</Tag>
                </div>
                <div class="feed-title">{{ item.title }}</div>
                <p class="feed-copy">{{ item.summary }}</p>
                <p class="feed-impact"><span>Analysis:</span> {{ item.analysis }}</p>
              </article>
            </div>
          </section>

          <aside class="reports-sidebar">
            <section v-if="reconSummary.total > 0" class="recon-strip reports-side-panel">
              <div class="recon-header">
                <div>
                  <div class="panel-kicker">Recon Net</div>
                  <div class="recon-title">{{ reconSummary.onStation }} on station · {{ reconSummary.inTransit }} in transit</div>
                </div>
                <Tag severity="contrast" rounded>{{ reconSummary.total }} probes</Tag>
              </div>
              <div class="recon-list recon-list-scroll">
                <div
                  v-for="item in reconSummary.items"
                  :key="item.probeId"
                  :class="['recon-item', `recon-${item.status}`]"
                >
                  <div class="recon-item-top">
                    <strong>{{ item.label }}</strong>
                    <span>{{ item.statusLabel }}</span>
                  </div>
                  <div class="recon-item-detail">{{ item.detail }}</div>
                </div>
              </div>
            </section>

            <section class="system-summary-panel reports-side-panel">
              <div class="panel-kicker">Focused System</div>
              <div v-if="selectedSystemOverview" class="selected-system-stack">
                <div class="panel-title">{{ selectedSystemOverview.title }}</div>
                <div v-if="selectedSystemOverview.homeLabel" class="system-subline system-home-line">{{ selectedSystemOverview.homeLabel }}</div>
                <div class="system-subline">{{ selectedSystemOverview.owner }}</div>
                <div class="system-subline">{{ selectedSystemOverview.starText }} · {{ selectedSystemOverview.metalText }}</div>
                <div class="system-subline">
                  {{ selectedSystemOverview.laneText }}<span v-if="selectedSystemOverview.blockadeText"> · {{ selectedSystemOverview.blockadeText }}</span>
                </div>
                <div class="system-facts reports-facts">
                  <div
                    v-for="fact in selectedSystemOverview.facts"
                    :key="`${selectedSystemOverview.title}-report-${fact.label}`"
                    class="system-fact"
                  >
                    <span class="system-fact-label">{{ fact.label }}</span>
                    <span class="system-fact-value">{{ fact.value }}</span>
                  </div>
                </div>
              </div>
              <div v-else class="map-empty-state reports-empty-state">
                Select a star from the map workspace to pin its details here.
              </div>
            </section>
          </aside>
        </section>

        <section v-else-if="ui.activeWorkspace === 'production'" class="workspace-page workspace-production-page">
          <section class="planning-strip production-main-panel">
            <div class="planning-header">
              <div>
                <div class="panel-kicker">Campaign Board</div>
                <div class="panel-title">Production Schedules</div>
              </div>
              <Tag severity="secondary" rounded>{{ productionPlannerRows.length }} systems</Tag>
            </div>

            <div v-if="productionPlannerRows.length > 0" class="production-sheet production-sheet-full">
              <div v-for="row in productionPlannerRows" :key="row.systemId" class="production-row production-row-large">
                <div class="production-top">
                  <div>
                    <strong>{{ row.systemName }}</strong>
                    <div class="production-meta">{{ row.outputText }}</div>
                  </div>
                  <div class="production-stores">{{ row.storesText }}</div>
                </div>

                <div class="production-fields production-fields-wide">
                  <div class="production-field">
                    <label>Focus</label>
                    <Select
                      :model-value="row.focus"
                      :options="PRODUCTION_FOCUS_OPTIONS"
                      option-label="label"
                      option-value="value"
                      fluid
                      @update:model-value="(value) => setProductionFocus(row.systemId, value)"
                    />
                  </div>

                  <div class="production-field production-quantity">
                    <label>Target</label>
                    <InputNumber
                      :model-value="row.quantity"
                      :min="1"
                      show-buttons
                      fluid
                      @update:model-value="(value) => setProductionQuantity(row.systemId, value)"
                    />
                  </div>

                  <div class="production-field">
                    <label>Posture</label>
                    <Select
                      :model-value="row.posture"
                      :options="PRODUCTION_POSTURE_OPTIONS"
                      option-label="label"
                      option-value="value"
                      fluid
                      @update:model-value="(value) => setProductionPosture(row.systemId, value)"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="planning-empty production-empty">
              Hold a system to begin drafting production schedules.
            </div>
          </section>
        </section>

        <section v-else class="workspace-page workspace-notebook-page">
          <section class="speculation-strip notebook-main-panel">
            <div class="planning-header">
              <div>
                <div class="panel-kicker">Speculation</div>
                <div class="panel-title">Private Notebook</div>
              </div>
            </div>

            <div class="notebook-copy">
              Capture theories, watchpoints, false leads, and future operations while you are away from the command table.
            </div>

            <Textarea
              :model-value="ui.planner.speculation"
              class="speculation-textarea speculation-textarea-large"
              rows="24"
              placeholder="What is the enemy massing for? Which lane looks exposed? Where should the next attack fall if their probe survives?"
              @update:model-value="setSpeculationText"
            />
          </section>
        </section>
      </main>
    </div>
  </div>
</template>
