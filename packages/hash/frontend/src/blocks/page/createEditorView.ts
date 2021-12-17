import { ApolloClient } from "@apollo/client";
import { BlockMeta } from "@hashintel/hash-shared/blockMeta";
import { createProseMirrorState } from "@hashintel/hash-shared/createProseMirrorState";
import { ProsemirrorNode } from "@hashintel/hash-shared/node";
import { BlockEntity } from "@hashintel/hash-shared/entity";
import { entityStoreFromProsemirror } from "@hashintel/hash-shared/entityStorePlugin";
import { apiOrigin } from "@hashintel/hash-shared/environment";
import { ProsemirrorSchemaManager } from "@hashintel/hash-shared/ProsemirrorSchemaManager";
import { updatePageMutation } from "@hashintel/hash-shared/save";
// import applyDevTools from "prosemirror-dev-tools";
import { Fragment, Schema } from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { BlockView } from "./BlockView";
import { EditorConnection } from "./collab/EditorConnection";
import { Reporter } from "./collab/Reporter";
import { collabEnabled } from "./collabEnabled";
import { ComponentView } from "./ComponentView";
import { createFormatPlugins } from "./createFormatPlugins";
import { createSuggester } from "./createSuggester/createSuggester";
import { MentionView } from "./MentionView/MentionView";
import styles from "./style.module.css";
import { RenderPortal } from "./usePortals";

const createSavePlugin = (
  accountId: string,
  pageEntityId: string,
  getLastSavedValue: () => BlockEntity[],
  client: ApolloClient<unknown>,
) => {
  let saveQueue = Promise.resolve<unknown>(null);

  const triggerSave = (view: EditorView<Schema>) => {
    if (collabEnabled) {
      return;
    }

    saveQueue = saveQueue
      .catch()
      .then(() =>
        updatePageMutation(
          accountId,
          pageEntityId,
          view.state.doc,
          getLastSavedValue(),
          entityStoreFromProsemirror(view.state).store,
          client,
        ),
      );
  };

  let timeout: ReturnType<typeof setTimeout> | null = null;

  return new Plugin<unknown, Schema>({
    props: {
      handleDOMEvents: {
        keydown(view, evt) {
          // Manual save for cmd+s
          if (evt.key === "s" && evt.metaKey) {
            evt.preventDefault();
            triggerSave(view);

            return true;
          }
          return false;
        },
        focus() {
          // Cancel the in-progress save
          if (timeout) {
            clearTimeout(timeout);
          }
          return false;
        },
        blur(view) {
          if (timeout) {
            clearTimeout(timeout);
          }

          timeout = setTimeout(() => triggerSave(view), 500);

          return false;
        },
      },
    },
  });
};

/**
 * The official typescript types for prosemirror don't yet understand that
 * `textBetween` supports a function for `leafText`
 *
 * @see https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/57769
 * @todo remove this when the types are updated
 */
interface ExtendedFragment extends Fragment<Schema> {
  textBetween(
    from: number,
    to: number,
    blockSeparator?: string | null,
    leafText?:
      | string
      | null
      | ((leafNode: ProsemirrorNode<Schema>) => string | null),
  ): string;
}

export const createEditorView = (
  renderNode: HTMLElement,
  renderPortal: RenderPortal,
  accountId: string,
  pageEntityId: string,
  preloadedBlocks: BlockMeta[],
  getLastSavedValue: () => BlockEntity[],
  client: ApolloClient<unknown>,
) => {
  let manager: ProsemirrorSchemaManager;

  const plugins: Plugin<unknown, Schema>[] = [
    createSavePlugin(accountId, pageEntityId, getLastSavedValue, client),
    ...createFormatPlugins(renderPortal),
    createSuggester(renderPortal, () => manager),
  ];

  const state = createProseMirrorState({ plugins });

  let connection: EditorConnection | null = null;

  const view = new EditorView<Schema>(renderNode, {
    state,

    /**
     * Prosemirror doesn't know to convert hard breaks into new line characters
     * in the plain text version of the clipboard when we copy out of the
     * editor. In the HTML version, they get converted as their `toDOM`
     * method instructs, but we have to use this for the plain text version.
     *
     * @todo find a way of not having to do this centrally
     * @todo look into whether this is needed for mentions and for links
     */
    clipboardTextSerializer: (slice) => {
      const fragment: ExtendedFragment = slice.content;

      return fragment.textBetween(
        0,
        fragment.size,
        "\n\n",
        (node: ProsemirrorNode<Schema>) => {
          if (node.type === view.state.schema.nodes.hardBreak) {
            return "\n";
          }

          return "";
        },
      );
    },
    nodeViews: {
      block(currentNode, currentView, getPos) {
        if (typeof getPos === "boolean") {
          throw new Error("Invalid config for nodeview");
        }
        return new BlockView(
          currentNode,
          currentView,
          getPos,
          renderPortal,
          manager,
        );
      },
      mention(currentNode, currentView, getPos) {
        if (typeof getPos === "boolean") {
          throw new Error("Invalid config for nodeview");
        }

        return new MentionView(
          currentNode,
          currentView,
          getPos,
          renderPortal,
          manager,
        );
      },
    },
    dispatchTransaction: collabEnabled
      ? (...args) => connection?.dispatchTransaction(...args)
      : undefined,
  });

  manager = new ProsemirrorSchemaManager(
    state.schema,
    view,
    (meta) => (node, editorView, getPos) => {
      if (typeof getPos === "boolean") {
        throw new Error("Invalid config for nodeview");
      }

      return new ComponentView(
        node,
        editorView,
        getPos,
        renderPortal,
        meta,
        accountId,
      );
    },
  );

  if (collabEnabled) {
    connection = new EditorConnection(
      new Reporter(),
      `${apiOrigin}/collab-backend/${accountId}/${pageEntityId}`,
      view.state.schema,
      view,
      manager,
      plugins,
    );
  }

  view.dom.classList.add(styles.ProseMirror);

  for (const meta of preloadedBlocks) {
    manager.defineNewBlock(meta);
  }

  // @todo figure out how to use dev tools without it breaking fast refresh
  // applyDevTools(view);

  return { view, connection, manager };
};
