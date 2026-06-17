<script setup>
import { nextTick, onMounted, ref, watch } from "vue";
import Tag from "primevue/tag";
import Button from "primevue/button";
import Select from "primevue/select";
import InputNumber from "primevue/inputnumber";
import Message from "primevue/message";
import { useCommandState } from "./useCommandState";

const store = useCommandState();
const {
  ORDER_ACTIONS,
  api,
  world,
  ui,
  currentSeat,
  selectedSystem,
  selectedSystemFriendly,
  selectedSystemOverview,
  summaryCards,
  mapLayout,
  mapCanvas,
  feedItems,
  orderBrief,
  orderSubmission,
  destinationOptions,
  anchorOptions,
  snapshotSystem,
  inboundFleets,
  totalShipsAtSystem,
  systemTone,
  starClass,
  loadInitialData,
  selectSystem,
  setSelectedSystemId,
  setActiveAction,
  prepareProbeForSystem,
  submitImmediateProbe,
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
        <Tag v-if="world.result" severity="info" rounded>{{ world.result.endDate }}</Tag>
        <Tag :severity="api.tone" rounded>{{ api.status }}</Tag>
      </div>
    </header>

    <Message v-if="api.error" severity="error" class="loading-message">
      {{ api.error }}
    </Message>

    <main class="battlefield">
      <section class="map-panel">
        <div class="map-topline">
          <div>
            <div class="panel-kicker">Operational Picture</div>
            <div class="panel-title">Galaxy Map</div>
          </div>

          <div v-if="selectedSystemOverview" class="system-inspector">
            <div class="system-summary">
              <div class="system-name">{{ selectedSystemOverview.title }}</div>
              <div class="system-subline">{{ selectedSystemOverview.owner }}</div>
              <div class="system-subline">
                {{ selectedSystemOverview.starText }} · {{ selectedSystemOverview.metalText }}
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
                label="Launch Probe"
                icon="pi pi-search"
                severity="contrast"
                :loading="api.submitting"
                @click="submitImmediateProbe(selectedSystem.system.id)"
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

      <aside class="feed-panel">
        <div class="feed-header">
          <div>
            <div>
              <div class="panel-kicker">Signal Feed</div>
              <div class="panel-title">Latest Reports</div>
            </div>
          </div>
          <Tag severity="info" rounded>{{ feedItems.length }} items</Tag>
        </div>

        <div class="feed-scroll">
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
      </aside>
    </main>

    <footer class="orders-panel">
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
              <div class="field">
                <label>Origin</label>
                <div class="static-field">{{ selectedSystem.system.name }}</div>
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
    </footer>
  </div>
</template>
