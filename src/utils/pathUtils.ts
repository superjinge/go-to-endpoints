/**
 * Joins URL path segments correctly, handling leading/trailing slashes.
 * Example: joinPaths("/api/", "/users", "/{id}/") => "/api/users/{id}"
 * @param segments Path segments to join.
 * @returns The combined path string.
 */
export function joinPaths(...segments: string[]): string {
  // 添加调试日志
  console.log(`[GoToEndpoint PathUtils] 路径合并: 输入=${JSON.stringify(segments)}`);

  // Filter out empty segments and normalize slashes
  const nonEmptySegments = segments
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0);

  if (nonEmptySegments.length === 0) {
    return ''; // Or perhaps '/' depending on desired behavior for empty input
  }

  // Join segments, ensuring single slashes between them
  const joined = nonEmptySegments.reduce((acc, current, index) => {
    let segmentToAdd = current;
    // Remove leading slash from segment unless it's the very first segment and only contains a slash
    if (index > 0 && segmentToAdd.startsWith('/')) {
        segmentToAdd = segmentToAdd.substring(1);
    }
    // Remove trailing slash from accumulator unless it's just "/"
    if (acc.endsWith('/') && acc.length > 1) {
        acc = acc.substring(0, acc.length - 1);
    }
    // Remove trailing slash from segment being added
    if (segmentToAdd.endsWith('/') && segmentToAdd.length > 1) {
        segmentToAdd = segmentToAdd.substring(0, segmentToAdd.length - 1);
    }

    // Add slash separator if needed
    if (acc && segmentToAdd && !acc.endsWith('/') && !segmentToAdd.startsWith('/')) {
        return acc + '/' + segmentToAdd;
    } else {
        return acc + segmentToAdd;
    }

  });

  // Ensure the final path starts with a slash if the first segment did, or if it's not empty
  let result;
  if (joined && !joined.startsWith('/')) {
      result = '/' + joined;
  } else if (!joined && nonEmptySegments.length > 0 && nonEmptySegments[0].startsWith('/')) {
      // Handle case where the only segment was '/', which got trimmed
      result = '/';
  } else {
      result = joined;
  }
  
  // 添加结果日志
  console.log(`[GoToEndpoint PathUtils] 路径合并: 结果=${result}`);
  return result;
} 