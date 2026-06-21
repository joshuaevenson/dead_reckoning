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
  PRODUCTION_LINE_FOCUS_OPTIONS,
  PRODUCTION_POSTURE_OPTIONS,
  STRATEGIC_MARKING_OPTIONS,
  api,
  world,
  ui,
  currentSeat,
  selectedSystem,
  selectedSystemOverview,
  selectedSystemProductionRow,
  summaryCards,
  selectedSystemAdvisorBriefs,
  diplomacyRows,
  diplomacySummary,
  mapLayout,
  mapCanvas,
  fleetMarkers,
  probeMarkers,
  starlaneSegments,
  feedItems,
  archivedReportItems,
  notebookTodoItems,
  reconSummary,
  orderBrief,
  orderSubmission,
  actionUnderway,
  originOptions,
  destinationOptions,
  anchorOptions,
  probeOriginOptions,
  snapshotSystem,
  inboundFleets,
  totalShipsAtSystem,
  blockadeStatus,
  probeBadgeForSystem,
  homeBadgeForSystem,
  systemTone,
  starClass,
  translateSystemId,
  loadInitialData,
  selectSystem,
  setSelectedSystemId,
  setActiveAction,
  setActiveWorkspace,
  setReportsTab,
  prepareProbeForSystem,
  setProbeOriginSystemId,
  archiveReportItem,
  markReportForFollowUp,
  restoreReportToInbox,
  setProductionPosture,
  setProductionLineFocus,
  setProductionLineQuantity,
  setStrategicMarking,
  clearStrategicMarking,
  setAdvisorIntentDraft,
  setSpeculationText,
  submitImmediateProbe,
  submitAdvisorIntent,
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

function openSystemOnMap(systemId) {
  setActiveWorkspace("map");
  selectSystem(systemId);
}

function formatReportSender(name, meta) {
  if (!meta) {
    return name;
  }

  return `${name} (${String(meta).replaceAll(" · ", " - ")})`;
}

function activeFleetOriginId() {
  return ui.orderDraft.originSystemId ?? null;
}

function draftShipLimit() {
  const originSystemId = activeFleetOriginId();
  if (!originSystemId || !currentSeat.value) {
    return 1;
  }

  return Math.max(1, totalShipsAtSystem(originSystemId, currentSeat.value.faction.id));
}

function orderDockReady() {
  if (ui.activeAction === "deploy_probe") {
    return Boolean(ui.orderDraft.anchorId || selectedSystem.value);
  }

  return Boolean(activeFleetOriginId());
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
    <header v-if="currentSeat || world.result || summaryCards.length" class="command-header">
      <div class="header-meta">
        <Tag v-if="currentSeat" severity="contrast" rounded>{{ currentSeat.faction.name }}</Tag>
        <Tag v-if="world.result" severity="info" rounded>{{ world.result.endDate }}</Tag>
      </div>

      <div v-if="summaryCards.length" class="header-analytics">
        <div v-for="card in summaryCards" :key="card.label" class="analytics-pill">
          <span class="analytics-label">{{ card.label }}</span>
          <span class="analytics-value">{{ card.value }}</span>
        </div>
      </div>
    </header>

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
        <Message v-if="api.error" severity="error" class="loading-message">
          {{ api.error }}
        </Message>

        <section v-if="ui.activeWorkspace === 'map'" class="workspace-page workspace-map-page">
          <div class="map-main-layout">
            <section class="map-panel workspace-map-panel">
              <div class="map-topline">
                <div>
                  <div class="panel-kicker">Operational Picture</div>
                  <div class="panel-title">Galaxy Map</div>
                </div>

                <div class="map-topline-copy">
                  Select a star to inspect it in the fixed sidebar. Probe coverage and incoming fleets stay visible on the map.
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
                      <g v-if="probeBadgeForSystem(system.id)" transform="translate(19 -22)">
                        <rect :class="['system-probe-badge', `probe-${probeBadgeForSystem(system.id).tone}`]" x="-10" y="-7" width="20" height="14" rx="7" />
                        <text x="0" y="4" text-anchor="middle" class="system-probe-text">{{ probeBadgeForSystem(system.id).label }}</text>
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

            <aside class="map-sidebar workspace-map-sidebar">
              <section class="system-summary-panel map-side-panel">
                <div class="panel-kicker">Focused System</div>
                <div v-if="selectedSystemOverview" class="selected-system-stack">
                  <div class="panel-title">{{ selectedSystemOverview.title }}</div>
                  <div v-if="selectedSystemOverview.homeLabel" class="system-subline system-home-line">{{ selectedSystemOverview.homeLabel }}</div>
                  <div class="system-subline">{{ selectedSystemOverview.owner }}</div>
                  <div class="system-subline">
                    {{ selectedSystemOverview.starText }} · {{ selectedSystemOverview.metalText }}
                  </div>
                  <div class="system-subline">
                    {{ selectedSystemOverview.laneText }}<span v-if="selectedSystemOverview.blockadeText"> · {{ selectedSystemOverview.blockadeText }}</span>
                  </div>

                  <div class="system-facts reports-facts">
                    <div
                      v-for="fact in selectedSystemOverview.facts"
                      :key="`${selectedSystemOverview.title}-map-${fact.label}`"
                      class="system-fact"
                    >
                      <span class="system-fact-label">{{ fact.label }}</span>
                      <span class="system-fact-value">{{ fact.value }}</span>
                    </div>
                  </div>

                  <div class="system-marking-panel">
                    <div class="panel-kicker">Strategic Marking</div>
                    <div class="system-marking-controls">
                      <Select
                        :model-value="selectedSystemOverview.strategicMarking?.value ?? null"
                        :options="STRATEGIC_MARKING_OPTIONS"
                        option-label="label"
                        option-value="value"
                        placeholder="Mark this system"
                        class="system-marking-select"
                        @update:model-value="setStrategicMarking(selectedSystem.system.id, $event)"
                      />
                      <Button
                        label="Clear"
                        icon="pi pi-times"
                        severity="secondary"
                        outlined
                        @click="clearStrategicMarking(selectedSystem.system.id)"
                      />
                    </div>
                    <div v-if="selectedSystemOverview.strategicMarking" class="system-marking-summary">
                      <Tag :severity="selectedSystemOverview.strategicMarking.severity" rounded>
                        {{ selectedSystemOverview.strategicMarking.label }}
                      </Tag>
                      <span>{{ selectedSystemOverview.strategicMarking.summary }}</span>
                    </div>
                  </div>

                  <div class="system-marking-panel">
                    <div class="panel-kicker">Advisor Readout</div>
                    <div v-if="selectedSystemAdvisorBriefs.length > 0" class="advisor-brief-list system-advisor-list">
                      <article
                        v-for="brief in selectedSystemAdvisorBriefs"
                        :key="brief.advisorId"
                        :class="['feed-card', 'feed-card-compact', `feed-tone-${brief.severity === 'contrast' ? 'info' : brief.severity}`]"
                      >
                        <div class="feed-card-top">
                          <div class="feed-kicker">{{ brief.role }}</div>
                          <Tag :severity="brief.severity" rounded>{{ brief.advisorName }}</Tag>
                        </div>
                        <div class="feed-title">{{ brief.headline }}</div>
                        <p class="feed-copy">{{ brief.summary }}</p>
                        <p class="feed-impact"><span>Why:</span> {{ brief.reasoning }}</p>
                      </article>
                    </div>
                    <div v-else class="notebook-copy">
                      Mark this system on the galaxy view and the council will start framing briefs around that priority.
                    </div>
                  </div>

                  <div v-if="selectedSystemProductionRow" class="system-marking-panel">
                    <div class="panel-kicker">Shipyards And Builds</div>
                    <div class="production-top production-top-local">
                      <div>
                        <strong>{{ selectedSystemProductionRow.systemName }}</strong>
                        <div class="production-meta">{{ selectedSystemProductionRow.outputText }}</div>
                        <div class="production-meta">
                          Infrastructure {{ selectedSystemProductionRow.infrastructure }} ·
                          {{ selectedSystemProductionRow.shipyardCount }} active shipyards
                        </div>
                      </div>
                      <div class="production-stores">{{ selectedSystemProductionRow.storesText }}</div>
                    </div>

                    <div class="production-fields production-fields-map">
                      <div class="production-field">
                        <label>Posture</label>
                        <Select
                          :model-value="selectedSystemProductionRow.posture"
                          :options="PRODUCTION_POSTURE_OPTIONS"
                          option-label="label"
                          option-value="value"
                          fluid
                          @update:model-value="(value) => setProductionPosture(selectedSystemProductionRow.systemId, value)"
                        />
                      </div>
                    </div>

                    <div class="shipyard-lines">
                      <div
                        v-for="line in selectedSystemProductionRow.lines"
                        :key="line.id"
                        class="shipyard-line"
                      >
                        <div class="shipyard-line-head">
                          <strong>{{ line.yardLabel }}</strong>
                          <span>{{ line.summary }}</span>
                        </div>

                        <div class="production-fields shipyard-line-fields">
                          <div class="production-field">
                            <label>Build</label>
                            <Select
                              :model-value="line.focus"
                              :options="PRODUCTION_LINE_FOCUS_OPTIONS"
                              option-label="label"
                              option-value="value"
                              fluid
                              @update:model-value="(value) => setProductionLineFocus(selectedSystemProductionRow.systemId, line.id, value)"
                            />
                          </div>

                          <div class="production-field production-quantity">
                            <label>Target</label>
                            <InputNumber
                              :model-value="line.quantity"
                              :min="line.focus === 'idle' ? 0 : 1"
                              show-buttons
                              fluid
                              @update:model-value="(value) => setProductionLineQuantity(selectedSystemProductionRow.systemId, line.id, value)"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    v-if="selectedSystemOverview.probeStatus && !selectedSystemOverview.canSeeLocalIntel"
                    class="system-probe-callout system-probe-sidebar-callout"
                  >
                    <div class="system-probe-copy">
                      <strong>{{ selectedSystemOverview.probeStatus.label }}</strong>
                      {{ selectedSystemOverview.probeStatus.detail }}
                    </div>
                    <div v-if="selectedSystemOverview.probeStatus.actionable" class="system-probe-actions">
                      <Button
                        label="Launch Probe"
                        icon="pi pi-send"
                        severity="contrast"
                        :loading="api.submitting && ui.activeAction === 'deploy_probe'"
                        @click="submitImmediateProbe(selectedSystem.system.id)"
                      />
                      <Button
                        label="Plan Launch"
                        icon="pi pi-search"
                        severity="secondary"
                        outlined
                        @click="prepareProbeForSystem(selectedSystem.system.id)"
                      />
                    </div>
                  </div>
                </div>
                <div v-else class="map-empty-state map-sidebar-empty">
                  Select a star to pin its details here without shifting the map.
                </div>
              </section>

              <section class="recon-strip map-side-panel">
                <div class="recon-header">
                  <div>
                    <div class="panel-kicker">Probe Net</div>
                    <div class="recon-title">{{ reconSummary.onStation }} on station · {{ reconSummary.inTransit }} in transit</div>
                  </div>
                  <Tag severity="contrast" rounded>{{ reconSummary.total }} probes</Tag>
                </div>
                <div class="recon-list recon-list-scroll">
                  <div
                    v-for="item in reconSummary.items.slice(0, 6)"
                    :key="item.probeId"
                    :class="['recon-item', `recon-${item.status}`]"
                  >
                    <div class="recon-item-top">
                      <strong>{{ item.label }}</strong>
                      <span>{{ item.statusLabel }}</span>
                    </div>
                    <div class="recon-item-detail">{{ item.detail }}</div>
                  </div>
                  <div v-if="reconSummary.total === 0" class="recon-empty">
                    No probes are currently deployed or in transit.
                  </div>
                </div>
              </section>
            </aside>
          </div>

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
                  <div class="panel-kicker">Manual Orders Dock</div>
                  <div class="panel-title">Precise System Orders</div>
                  <div class="orders-status-copy">Use the galaxy view when you want to issue explicit fleet, trade, blockade, or probe orders yourself.</div>
                </div>
                <Tag :severity="orderDockReady() ? 'success' : 'secondary'" rounded>
                  {{ ui.activeAction === 'deploy_probe' ? (ui.orderDraft.anchorId || selectedSystem ? "Target selected" : "Choose target") : (activeFleetOriginId() ? "Ready to order" : "Choose origin") }}
                </Tag>
              </div>
            </div>

            <div class="orders-drawer">
              <div class="orders-layout">
                <div class="orders-main-stack">
                  <div class="form-grid">
                    <div v-if="ui.activeAction !== 'deploy_probe'" class="field">
                      <label>Origin</label>
                      <Select
                        v-model="ui.orderDraft.originSystemId"
                        :options="originOptions"
                        option-label="label"
                        option-value="value"
                        placeholder="Choose origin system"
                        show-clear
                        fluid
                      />
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
                        :max="draftShipLimit()"
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

                  <div class="orders-tracker">
                    <div>
                      <div class="panel-kicker">Tracking</div>
                      <div class="orders-underway-title">{{ actionUnderway.title }}</div>
                      <p class="orders-underway-copy">{{ actionUnderway.summary }}</p>
                    </div>
                    <div class="orders-underway-copy">
                      Probes, fleets, and build posture stay visible on the galaxy map now instead of separate operations boards.
                    </div>
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
            </div>
          </section>
        </section>

        <section v-else-if="ui.activeWorkspace === 'diplomacy'" class="workspace-page workspace-diplomacy-page">
          <section class="feed-panel operations-main-panel">
            <div class="feed-header">
              <div>
                <div class="panel-kicker">Political Picture</div>
                <div class="panel-title">Diplomacy Board</div>
              </div>
              <Tag severity="info" rounded>{{ diplomacySummary.total }} known kingdoms</Tag>
            </div>

            <div class="probe-operations-scroll">
              <article
                v-for="item in diplomacyRows"
                :key="item.factionId"
                :class="['feed-card probe-feed-card', `feed-tone-${item.stanceSeverity}`]"
              >
                <div class="feed-card-top">
                  <div class="feed-kicker">Observed Stance</div>
                  <Tag :severity="item.stanceSeverity" rounded>{{ item.stanceLabel }}</Tag>
                </div>
                <div class="feed-title">{{ item.factionName }}</div>
                <p class="feed-copy">{{ item.stanceSummary }}</p>
                <p class="feed-impact"><span>Home:</span> {{ item.homeSystemName }}</p>
                <p class="feed-impact"><span>Strength:</span> {{ item.strengthText }}</p>
                <p class="feed-impact"><span>Pressure:</span> {{ item.pressureText }}</p>
                <p class="feed-impact">
                  <span>Latest signal:</span>
                  {{ item.latestSignalText }}
                  <template v-if="item.latestSignalDate">({{ item.latestSignalDate }})</template>
                </p>
                <div class="probe-feed-actions">
                  <Button
                    label="Open Home On Map"
                    icon="pi pi-globe"
                    severity="secondary"
                    outlined
                    @click="openSystemOnMap(item.homeSystemId)"
                  />
                </div>
              </article>

              <div v-if="diplomacyRows.length === 0" class="planning-empty probes-empty">
                No rival kingdoms are visible from this seat yet.
              </div>
            </div>
          </section>

          <aside class="probes-sidebar diplomacy-sidebar">
            <section class="reports-side-panel diplomacy-summary-panel">
              <div class="planning-header">
                <div>
                  <div class="panel-kicker">Reading Guide</div>
                  <div class="panel-title">Observed Relations</div>
                </div>
              </div>

              <p class="diplomacy-note">
                These standings are inferred from current territory, fleet motion, and recent reports. They are not formal treaties.
              </p>

              <div class="diplomacy-summary-grid">
                <div class="diplomacy-summary-card danger">
                  <strong>Hostile</strong>
                  <span>{{ diplomacySummary.hostile }} kingdoms</span>
                </div>
                <div class="diplomacy-summary-card warn">
                  <strong>Tense</strong>
                  <span>{{ diplomacySummary.tense }} kingdoms</span>
                </div>
                <div class="diplomacy-summary-card info">
                  <strong>Watchful</strong>
                  <span>{{ diplomacySummary.watchful }} kingdoms</span>
                </div>
                <div class="diplomacy-summary-card secondary">
                  <strong>Distant</strong>
                  <span>{{ diplomacySummary.distant }} kingdoms</span>
                </div>
              </div>
            </section>

            <section class="reports-side-panel diplomacy-summary-panel">
              <div class="planning-header">
                <div>
                  <div class="panel-kicker">Priority Watch</div>
                  <div class="panel-title">Closest Pressures</div>
                </div>
              </div>

              <div class="operations-origin-list">
                <div
                  v-for="row in diplomacyRows.slice(0, 5)"
                  :key="`${row.factionId}-watch`"
                  class="probe-depot-card"
                >
                  <div class="probe-depot-top">
                    <strong>{{ row.factionName }}</strong>
                    <Tag :severity="row.stanceSeverity" rounded>{{ row.stanceLabel }}</Tag>
                  </div>
                  <div class="probe-depot-meta">{{ row.pressureText }}</div>
                  <div class="probe-depot-meta">{{ row.strengthText }}</div>
                  <Button
                    label="Open Home On Map"
                    icon="pi pi-globe"
                    severity="secondary"
                    outlined
                    @click="openSystemOnMap(row.homeSystemId)"
                  />
                </div>
              </div>
            </section>
          </aside>
        </section>

        <section v-else-if="ui.activeWorkspace === 'reports'" class="workspace-page workspace-reports-page">
          <section class="feed-panel reports-main-panel">
            <div class="feed-header">
              <div class="panel-title">Advisors and Commanders</div>
              <Button
                :label="ui.reportsTab === 'archive' ? 'Inbox' : 'Archive'"
                severity="secondary"
                text
                size="small"
                @click="setReportsTab(ui.reportsTab === 'archive' ? 'inbox' : 'archive')"
              />
            </div>

            <section class="reports-queue-section">
              <div v-if="ui.reportsTab === 'inbox' && feedItems.length > 0" class="feed-scroll reports-scroll">
                <article
                  v-for="item in feedItems"
                  :key="item.id"
                  :class="['feed-card', 'reports-missive-card', `feed-tone-${item.tone}`]"
                >
                  <div class="reports-missive-sender">
                    <div class="reports-missive-name">{{ formatReportSender(item.advisorName, item.missiveMeta) }}</div>
                    <div class="reports-missive-date">{{ item.date }}</div>
                  </div>
                  <div class="feed-title">{{ item.title }}</div>
                  <div class="reports-missive-body">
                    <p
                      v-for="(paragraph, index) in item.missiveParagraphs"
                      :key="`${item.id}:paragraph:${index}`"
                      class="feed-copy"
                    >
                      {{ paragraph }}
                    </p>
                  </div>
                  <div class="feed-actions reports-card-actions">
                    <Button
                      label="Follow up"
                      severity="secondary"
                      text
                      size="small"
                      @click="markReportForFollowUp(item)"
                    />
                    <Button
                      label="Archive"
                      severity="secondary"
                      text
                      size="small"
                      @click="archiveReportItem(item)"
                    />
                  </div>
                </article>
              </div>

              <div v-else-if="ui.reportsTab === 'archive' && archivedReportItems.length > 0" class="feed-scroll reports-scroll">
                <article
                  v-for="item in archivedReportItems"
                  :key="`archive-${item.id}`"
                  :class="['feed-card', 'reports-missive-card', `feed-tone-${item.tone}`]"
                >
                  <div class="reports-missive-sender">
                    <div class="reports-missive-name">
                      {{ formatReportSender(item.advisorName ?? item.actorName ?? "Council", item.missiveMeta || `${item.actorLabel ?? "Council"} · ${item.advisorRole ?? item.kicker}`) }}
                    </div>
                    <div class="reports-missive-date">{{ item.date }}</div>
                  </div>
                  <div class="feed-title">{{ item.title }}</div>
                  <div class="reports-missive-body">
                    <p
                      v-for="(paragraph, index) in item.missiveParagraphs"
                      :key="`${item.id}:archive:${index}`"
                      class="feed-copy"
                    >
                      {{ paragraph }}
                    </p>
                  </div>
                  <div class="feed-actions reports-card-actions">
                    <Button
                      label="Restore"
                      severity="secondary"
                      text
                      size="small"
                      @click="restoreReportToInbox(item.id)"
                    />
                    <Button
                      label="Follow up"
                      severity="secondary"
                      text
                      size="small"
                      @click="markReportForFollowUp(item)"
                    />
                  </div>
                </article>
              </div>

              <div v-else-if="ui.reportsTab === 'inbox'" class="map-empty-state reports-empty-state reports-empty-main">
                The live queue is clear. Open the archive if you want the paper trail, and move anything longer-lived into notes as follow-up.
              </div>
              <div v-else class="map-empty-state reports-empty-state reports-empty-main">
                Archive items here to keep the live queue short without losing the paper trail.
              </div>
            </section>

            <section class="reports-order-panel">
              <Textarea
                :model-value="ui.planner.advisorIntentDraft"
                class="reports-order-textarea"
                rows="1"
                auto-resize
                placeholder="Standing orders..."
                @update:model-value="setAdvisorIntentDraft"
              />

              <Button
                label="Send"
                severity="secondary"
                text
                size="small"
                :disabled="!ui.planner.advisorIntentDraft.trim()"
                @click="submitAdvisorIntent"
              />
            </section>
          </section>
        </section>

        <section v-else class="workspace-page workspace-notebook-page">
          <section class="speculation-strip notebook-main-panel">
            <div class="planning-header">
              <div>
                <div class="panel-kicker">Speculation</div>
                <div class="panel-title">Private Notebook</div>
              </div>
              <Tag severity="warn" rounded>{{ notebookTodoItems.length }} follow-ups</Tag>
            </div>

            <div class="notebook-layout">
              <section class="notebook-todo-panel">
                <div class="panel-kicker">Notes Queue</div>
                <div class="notebook-copy">
                  Mark council notes for follow-up when they need synthesis, cross-checking, or a future plan before they belong in your notes.
                </div>

                <div v-if="notebookTodoItems.length > 0" class="report-triage-list notebook-todo-list">
                  <article
                    v-for="item in notebookTodoItems"
                    :key="`todo-${item.id}`"
                    :class="['feed-card', 'feed-card-compact', `feed-tone-${item.tone}`]"
                  >
                    <div class="feed-card-top">
                      <div class="feed-kicker">{{ item.kicker }}</div>
                      <Tag :severity="item.tone" rounded>{{ item.date }}</Tag>
                    </div>
                    <div class="feed-title">{{ item.title }}</div>
                    <div class="feed-byline">{{ item.actorLabel ?? "Council" }} · {{ item.advisorName ?? "Advisor queue" }} · {{ item.advisorRole ?? item.kicker }}</div>
                    <p class="feed-copy">{{ item.summary }}</p>
                    <p class="feed-impact"><span>Consequence:</span> {{ item.analysis }}</p>
                    <div class="feed-actions feed-actions-compact">
                      <Button
                        label="Return to Queue"
                        icon="pi pi-replay"
                        severity="secondary"
                        outlined
                        @click="restoreReportToInbox(item.id)"
                      />
                      <Button
                        label="Archive"
                        icon="pi pi-check"
                        severity="contrast"
                        @click="archiveReportItem(item)"
                      />
                    </div>
                  </article>
                </div>
                <div v-else class="map-empty-state reports-empty-state notebook-empty-state">
                  No follow-up items yet. Flag inbox notes when they deserve a longer pass in your notes.
                </div>
              </section>

              <section class="notebook-notes-panel">
                <div class="panel-kicker">Notes</div>
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
            </div>
          </section>
        </section>
      </main>
    </div>
  </div>
</template>
