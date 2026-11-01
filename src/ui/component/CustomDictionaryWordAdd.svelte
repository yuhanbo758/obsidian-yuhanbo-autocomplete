<!--suppress LabeledStatementJS -->
<script lang="ts">
  import ObsidianButton from "./ObsidianButton.svelte";
  import { File } from "svelte-lucide-icons";
  import ObsidianIconButton from "./ObsidianIconButton.svelte";
  import type { CustomDictionaryWord } from "../../model/Word";
  import { onMount } from "svelte";

  type Dictionary = {
    id: string;
    path: string;
  };

  export let dictionaries: Dictionary[];
  export let selectedDictionary: Dictionary;
  export let inputWord: string = "";
  export let useDisplayedWord = false;
  export let displayedWord: string = "";
  export let description: string = "";
  export let aliases: string[] = [];
  export let dividerForDisplay = "";

  export let onSubmit: (
    dictionaryPath: string,
    word: CustomDictionaryWord,
  ) => void;
  export let onClickFileIcon: (dictionaryPath: string) => void;

  let aliasesStr = aliases.join("\n");
  let wordRef: HTMLElement | null = null;
  let displayedWordRef: HTMLElement | null = null;

  $: enableSubmit = inputWord.length > 0 && Boolean(selectedDictionary);
  $: enableDisplayedWord = Boolean(dividerForDisplay);
  $: firstWordTitle = useDisplayedWord ? "插入内容" : "词语";
  $: {
    if (useDisplayedWord) {
      displayedWordRef?.focus();
    }
  }

  const handleSubmit = () => {
    onSubmit(selectedDictionary.path, {
      value: displayedWord || inputWord,
      description,
      aliases: aliasesStr.split("\n"),
      type: "customDictionary",
      createdPath: selectedDictionary.path,
      insertedText: displayedWord ? inputWord : undefined,
    });
  };

  onMount(() => {
    const timer = setTimeout(() => wordRef?.focus(), 50);
    return () => clearTimeout(timer);
  });
</script>

<div class="autocomplete-dictionary-modal">
  <h2>添加到自定义词库</h2>

  <h3>词库</h3>
  <div class="autocomplete-dictionary-row">
    <select bind:value={selectedDictionary} class="dropdown">
      {#each dictionaries as dictionary}
        <option value={dictionary}>
          {dictionary.path}
        </option>
      {/each}
    </select>
    <ObsidianIconButton
      popup="打开词库文件"
      on:click={() => onClickFileIcon(selectedDictionary.path)}
    >
      <File />
    </ObsidianIconButton>
  </div>

  <h3>{firstWordTitle}</h3>
  <textarea
    bind:value={inputWord}
    class="autocomplete-dictionary-input"
    rows="3"
    bind:this={wordRef}
  />

  {#if enableDisplayedWord}
    <label>
      <input type="checkbox" bind:checked={useDisplayedWord} />
      分别指定显示文字和插入内容
    </label>
  {/if}

  {#if useDisplayedWord}
    <h3>显示文字</h3>
    <textarea
      bind:value={displayedWord}
      class="autocomplete-dictionary-input"
      rows="3"
      bind:this={displayedWordRef}
    />
  {/if}

  <h3>说明</h3>
  <input
    type="text"
    bind:value={description}
    class="autocomplete-dictionary-input"
  />

  <h3>别名（每行一个）</h3>
  <textarea
    bind:value={aliasesStr}
    class="autocomplete-dictionary-input"
    rows="3"
  />

  <div class="autocomplete-dictionary-actions">
    <ObsidianButton disabled={!enableSubmit} on:click={handleSubmit}
      >添加</ObsidianButton
    >
  </div>
</div>

<style>
</style>
